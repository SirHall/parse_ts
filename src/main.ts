// Started: ‎Monday, ‎29 ‎March ‎2021, ‏‎10:09:50 AM

export interface InDat {
    str: string;
    pos: InputPos;
}

export const MkInDat = (s: string): InDat => Id({ str: s, pos: [0, 0] });

export type Parser = (inDat: InDat) => Dat;

export const Fail = null;
export const NullPos: InputPos = [-1, -1];

export type DatValue = any | null;
// export type DatTag = string;
export type LineIndex = number;
export type CharIndex = number;
export type InputPos = [LineIndex, CharIndex];
export type DatRemainder = string;

export type Dat = [DatValue, InputPos, DatRemainder];
// A combiner is a function that combines two output strings
export type Combiner = (a: Dat, b: Dat) => Dat;

export const DefComb: Combiner = (a, b) => [{ "l": Value(a), "r": Value(b) }, Pos(b), Remaining(b)];
export const StrComb: Combiner = (a, b) => [Value(a) + Value(b), Pos(b), Remaining(b)];
export const LeftComb: Combiner = (a, b) => [Value(a), Pos(b), Remaining(b)];
export const RightComb: Combiner = (a, b) => [Value(b), Pos(b), Remaining(b)];
export const RTreeComb = (tag: string): Combiner => (a, b) => [{ "c": Value(a), "t": tag, "r": Value(b) }, Pos(b), Remaining(b)];
export const LTreeComb = (tag: string): Combiner => (a, b) => [{ "c": Value(b), "t": tag, "l": Value(a) }, Pos(b), Remaining(b)];
export const TreeComb = (val: DatValue, tag: string): Combiner => (a, b) => [{ "c": val, "t": tag, "l": Value(a), "r": Value(b) }, Pos(b), Remaining(b)];

export const Success = (n: Dat) => n[0] !== Fail;
export const Failed = (n: Dat) => !Success(n);
export const MkFail = (pos: InputPos, msg: string = ""): Dat => [Fail, pos, msg];
export const MkFailD = (d: Dat, msg: string = ""): Dat => MkFail(Pos(d), msg);
export const Value = (n: Dat) => n[0] ?? "";
export const Pos = (n: Dat) => n[1];
export const PosLine = (p: InputPos) => p[0];
export const PosChar = (p: InputPos) => p[1];
export const IsNullPos = (p: InputPos) => PosLine(p) < 0 || PosChar(p) < 0;
export const Remaining = (n: Dat) => n[2];
export const Id = (n: any) => n;
export const DatToIn = (d: Dat): InDat => { return { str: Remaining(d), pos: Pos(d) } };

export const ModifyDat = (p: Parser, f: (dat: Dat) => Dat): Parser => str => {
    let d: Dat = p(str);
    return Failed(d) ? d : f(d);
}

export const ModifyVal = (p: Parser, f: (d: DatValue) => DatValue): Parser => ModifyDat(p, d => [f(Value(d)), Pos(d), Remaining(d)]);
export const ReplaceVal = (p: Parser, v: DatValue): Parser => ModifyDat(p, d => [v, Pos(d), Remaining(d)]);
export const ConsumeAll = (p: Parser): Parser => inDat => {
    let res: Dat = p(inDat);
    return Remaining(res).length > 0 ? res : res;
}

// If the input is a fail, then replace its error message
export const FailMsg = (p: Parser, msg: string): Parser => inDat => {
    let res: Dat = p(inDat);
    return Failed(res) ? MkFailD(res, msg) : res;
}

// If the input is a fail, then modify its error message
export const FailMsgM = (p: Parser, f: (d: Dat) => string): Parser => inDat => {
    let res: Dat = p(inDat);
    return Failed(res) ? MkFailD(res, f(res)) : res;
}

export function RunComb(a: Dat, b: Dat, comb: Combiner): Dat {
    if (Failed(a)) return a;
    if (Failed(b)) return b;
    return comb(a, b);
}

export const Always = (v: string): Parser => inDat => [v, inDat.pos, inDat.str];

export const Not = (v: Parser): Parser => inDat => {
    let res: Dat = v(inDat);
    return [Success(res) ? Fail : "", Pos(res), Remaining(res)];
}


export const Then = (a: Parser, b: Parser, comb: Combiner = DefComb): Parser => inDat => {
    let aRes: Dat = a(inDat);
    if (Failed(aRes)) return aRes;
    let bRes: Dat = b(DatToIn(aRes));
    return RunComb(aRes, bRes, comb);
}

export const ThenR = (a: Parser, b: Parser, comb: Combiner = DefComb): Parser => inDat => {
    if (inDat.str.length == 0) return MkFail(inDat.pos);
    let skipped: InDat = { str: "", pos: NullPos };
    let bRes: Dat = MkFail(inDat.pos);
    for (let i = 1; i < inDat.str.length; i++) {
        bRes = b({ str: inDat.str.slice(i), pos: inDat.pos });
        if (Success(bRes)) {
            skipped = { str: inDat.str.slice(0, i), pos: inDat.pos };
            break;
        }
    }
    if (skipped.str === "" || IsNullPos(skipped.pos) || Failed(bRes)) return bRes;
    let aRes = ConsumeAll(a)(skipped);
    if (Failed(aRes)) return aRes;
    return RunComb(aRes, bRes, comb);
};

export function Or(a: Parser, b: Parser): Parser {
    return inDat => {
        let aRes: Dat = a(inDat);
        return Success(aRes) ? aRes : b(inDat);
    };
}

export function And(a: Parser, b: Parser, comb: Combiner = DefComb): Parser {
    return (str) => {
        let aRes: Dat = a(str);
        if (Failed(aRes)) return aRes; // The source parser should set the message
        let bRes: Dat = b(str);
        if (Failed(bRes)) return bRes; // The source parser should set the message
        return RunComb(aRes, bRes, comb);
    };
}

// Inclusive Or. You can have a then b or either a or b
export const EitherOr = (a: Parser, b: Parser, comb: Combiner = DefComb): Parser => Or(Then(a, b, comb), Or(a, b));

export const Chain = (chain: Parser[], comb: Combiner = DefComb): Parser => inDat => {
    if (chain.length == 0) return MkFail(inDat.pos, "End of Chain");
    if (chain.length == 1) return chain[0](inDat);
    return Then(chain[0], Chain(chain.slice(1), comb), comb)(inDat);
};

// A normal chain, but where only the selected (by index) parser's result is returned
export const ChainSelect = (chain: Parser[], index: number = 0): Parser => inDat => {
    if (chain.length == 0) return MkFail(inDat.pos, "End of ChainSelect");
    if (chain.length == 1) return chain[0](inDat);
    return Then(chain[0], ChainSelect(chain.slice(1), index - 1), index == 0 ? LeftComb : RightComb)(inDat);
};

export const OrChain = (chain: Parser[]): Parser => inDat => {
    if (chain.length == 0) return MkFail(inDat.pos, "End of OrChain");
    if (chain.length == 1) return chain[0](inDat);
    return Or(chain[0], OrChain(chain.slice(1)))(inDat);
};

export const OneOrNone = (p: Parser): Parser => Or(p, Always(""));

export const OneOrMany = (p: Parser, comb: Combiner = DefComb): Parser =>
    str => Or(Then(p, OneOrMany(p, comb), comb), p)(str);

export const NoneOrMany = (p: Parser, comb: Combiner = DefComb): Parser =>
    OneOrNone(OneOrMany(p, comb));

export const NoneOrManyUntil = (pa: Parser, pb: Parser, comb: Combiner = DefComb): Parser =>
    str => Or(pb, Then(pa, NoneOrManyUntil(pa, pb, comb), comb))(str);

export const OneOrManyUntil = (pa: Parser, pb: Parser, comb: Combiner = DefComb): Parser =>
    Then(pa, Or(pb, NoneOrManyUntil(pa, pb, comb)), comb);

export const ReadCharF = (predicate: (s: string) => boolean): Parser => inDat => {
    if (inDat.str.length > 0 && predicate(inDat.str[0]))
        return [inDat.str[0], [PosLine(inDat.pos), PosChar(inDat.pos) + 1], inDat.str.slice(1)];
    return MkFail(inDat.pos, (inDat.str.length > 0) ?
        `'${inDat.str[0]}' did not match the predicate` :
        `Input string was empty`
    );
};

// Parses the next character if it is contained within the 'chars' list
export const Chars = (chars: string[]): Parser => inDat =>
    FailMsgM(ReadCharF((s) => chars.indexOf(s) >= 0),
        d => {
            if (chars.length === 0) return `Input character list is empty`;
            if (inDat.str.length === 0) return `Reached end of input string`;
            return `${inDat.str[0]} is not contained within [${chars.join(' ')}]`;
        }
    )(inDat);

export const Char = (char: string): Parser => inDat =>
    FailMsgM(ReadCharF((s) => s === char),
        d => {
            if (inDat.str.length === 0) return `Reached end of input string`;
            return `${inDat.str[0]} does not match expected character '${char}'`;
        })(inDat);

export const Keyword = (word: string): Parser => inDat =>
    FailMsgM(word.length == 0 ? Always("") : Then(Char(word[0]), Keyword(word.slice(1)), StrComb),
        d => {
            if (inDat.str.length === 0) return `Reached end of input string`;
            return `${inDat.str[0]} does not match expected word '${word}'`;
        })(inDat);

export const Maybe = (v: string): Parser => Or(Char(v), Always(""));

export const AnyChar = ReadCharF(s => true);

export const ConsumeUntil = (p: Parser, comb: Combiner = DefComb): Parser =>
    str => NoneOrManyUntil(AnyChar, p, comb)(str);

export const EscapedChar = And(Char("\\"), AnyChar);

export const Str = Then(Char('"'), NoneOrManyUntil(AnyChar, Char('"')));

export const Digit = Chars(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

// Shortest way I could think of to write 'Whitespace'
export const NewLine = ModifyDat(Char("\n"), d => ["\n", [PosLine(Pos(d)) + 1, 0], Remaining(d)]);
export const Air = Chars([" ", "\t", "\p", "\r"]);
export const Airs = NoneOrMany(Air);
export const Comma = Char(",");
export const Dot = Char(".");
export const Addition = Or(Chars(["+", "a"]), Keyword("add"));
export const Subtraction = Or(Chars(["-", "s"]), Keyword("sub"));
export const Mult = Or(Chars(["*", "m"]), Keyword("mult"));
export const Division = Or(Chars(["/", "d"]), Keyword("div"));
export const OpenParen = Chars(["(", "[", "{"]);
export const CloseParen = Chars([")", "]", "}"]);
export const Modulo = Char("%");

export const SurroundAir = (p: Parser) => Then(Airs, Then(p, Airs, LeftComb), RightComb);
export const ArgComma = SurroundAir(Comma);
export const ArgOpenParen = SurroundAir(OpenParen);
export const ArgCloseParen = SurroundAir(CloseParen);

export const Num =
    ModifyVal(
        EitherOr(OneOrMany(Or(Digit, Comma), StrComb), Then(Dot, OneOrMany(Digit, StrComb), StrComb), StrComb),
        d => Id({ "c": +d, "t": "Num" })
    );

let registeredFuncs: { [name: string]: { f: (fArgs: any[]) => number } } = {};

// Expression
export const Exp = (): Parser => str => OrChain([
    ExpAdd,
    ExpSub,
    ExpMult,
    ExpDiv,
    InfixOp(Modulo, "%"),
    ExpPow,
    ExpRegisteredFunc(),
    ExpParen,
    Num,
])(str);

export const ExpParen = Then(Then(ArgOpenParen, Exp(), RightComb), ArgCloseParen, LeftComb);

export const InfixOp = (op: Parser, opTag: string): Parser => str =>
    Then(
        ThenR(Exp(), SurroundAir(op), LeftComb),
        Exp(),
        TreeComb(opTag, opTag)
    )(str);

export const ExpAdd = InfixOp(Addition, "+");
export const ExpMult = InfixOp(Mult, "*");
export const ExpSub = InfixOp(Subtraction, "-");
export const ExpDiv = InfixOp(Division, "/");
export const ExpPow = InfixOp(Char("^"), "^");

export const ExpFuncArgs = (): Parser => str =>
    Or(
        ThenR(Exp(), Then(ArgComma, ExpFuncArgs(), RightComb), RTreeComb("arg")),
        ModifyVal(Exp(),
            v => Id({ "c": v, "t": "arg", "r": { "c": null, "t": "argend" } })
        ))(str);

export const ExpFunc = (funcName: string): Parser =>
    ModifyVal(
        ChainSelect([Airs, Keyword(funcName), Airs, OpenParen, Airs, ExpFuncArgs(), Airs, CloseParen, Airs], 5),
        v => Id({ "c": v, "t": "func", "func": funcName })
    );

export const ExpRegisteredFunc = (): Parser => OrChain(Object.entries(registeredFuncs).map(n => ExpFunc(n[0])));

export function RunBase(v: any): number {
    return Evaluate(Value(v));
}

export function Evaluate(v: any): number {
    switch (v["t"]) {
        case "+": return EvalAdd(v);
        case "-": return EvalSub(v);
        case "*": return EvalMult(v);
        case "/": return EvalDiv(v);
        case "Num": return EvalNum(v);
        case "^": return EvalPow(v);
        case "func": return EvalRegisteredFuncs(v);
        case "%": return EvalModulo(v);
    }
    console.log(`Unrecognized tag: '${v["t"]}'\n${JSON.stringify(v, null, 4)}`);
    return 0.0;
}

export const EvalNum = (v: any): number => v["c"];
export const EvalAdd = (v: any): number => Evaluate(v["l"]) + Evaluate(v["r"]);
export const EvalSub = (v: any): number => Evaluate(v["l"]) - Evaluate(v["r"]);
export const EvalMult = (v: any): number => Evaluate(v["l"]) * Evaluate(v["r"]);
export const EvalDiv = (v: any): number => Evaluate(v["l"]) / Evaluate(v["r"]);
export const EvalPow = (v: any): number => Evaluate(v["l"]) ** Evaluate(v["r"]);
export const EvalModulo = (v: any): number => Evaluate(v["l"]) % Evaluate(v["r"]);
export const EvalFunc = (v: any, f: (a: any[]) => number): number => f.apply(null, [EvalArgs(v["c"])]);
export const EvalArgs = (v: any): any[] => {
    if (v["t"] === "argend") return [];
    return [Evaluate(v["c"])].concat(EvalArgs(v["r"]));
}
export const EvalRegisteredFuncs = (v: any): number => {
    if (registeredFuncs[v["func"]])
        return EvalFunc(v, registeredFuncs[v["func"]].f);
    console.log(`Function '${v["func"]} not recognized`)
    return 0.0;
}

export const RegisterFunc = (name: string, f: (fArgs: any[]) => number) => registeredFuncs[name] = { f: f };

RegisterFunc("sqrt", xs => Math.sqrt(xs[0]));
RegisterFunc("mod", xs => xs[0] % xs[1]);
RegisterFunc("round", xs => Math.round(xs[0]));
RegisterFunc("floor", xs => Math.floor(xs[0]));
RegisterFunc("ceil", xs => Math.ceil(xs[0]));
RegisterFunc("sin", xs => Math.sin(xs[0]));
RegisterFunc("cos", xs => Math.cos(xs[0]));
RegisterFunc("tan", xs => Math.tan(xs[0]));
RegisterFunc("atan2", xs => Math.atan2(xs[0], xs[1]));
RegisterFunc("asin", xs => Math.asin(xs[0]));
RegisterFunc("acos", xs => Math.acos(xs[0]));
RegisterFunc("log", xs => Math.log(xs[1]) / Math.log(xs[0]));
RegisterFunc("log2", xs => Math.log2(xs[0]));
RegisterFunc("log10", xs => Math.log10(xs[0]));
RegisterFunc("exp", xs => Math.exp(xs[0]));
RegisterFunc("rand", xs => Math.random());


let input = Deno.args.join(" ");

// console.log(Exp()(MkInDat(input)));
console.log(RunBase(Exp()(MkInDat(input))));
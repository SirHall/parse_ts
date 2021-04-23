// Started: ‎Monday, ‎29 ‎March ‎2021, ‏‎10:09:50 AM

export const Fail = null;

export type DatValue = any | null;
export type DatTag = string;
export type DatRemainder = string;

export type Dat = [DatValue, DatTag, DatRemainder];
// A combiner is a function that combines two output strings
export type Combiner = (a: Dat, b: Dat) => Dat;

export const DefComb: Combiner = (a, b) => [{ "l": Value(a), "r": Value(b) }, "", Remaining(b)];
export const StrComb: Combiner = (a, b) => [Value(a) + Value(b), "", Remaining(b)];
export const LeftComb: Combiner = (a, b) => [Value(a), "", Remaining(b)];
export const RightComb: Combiner = (a, b) => [Value(b), "", Remaining(b)];
export const RTreeComb = (tag: string): Combiner => (a, b) => [{ "c": Value(a), "t": tag, "r": Value(b) }, "", Remaining(b)];
export const LTreeComb = (tag: string): Combiner => (a, b) => [{ "c": Value(b), "t": tag, "l": Value(a) }, "", Remaining(b)];

export const Success = (n: Dat) => n[0] !== Fail;
export const Failed = (n: Dat) => !Success(n);
export const MkFail = (str: string): Dat => [Fail, "", str];
export const Value = (n: Dat) => n[0] ?? "";
export const Tag = (n: Dat) => n[1];
export const Remaining = (n: Dat) => n[2];
export const Id = (n: any) => n;

export const ModifyDat = (p: Parser, f: (dat: Dat) => Dat): Parser => str => {
    let d: Dat = p(str);
    return Failed(d) ? MkFail(str) : f(d);
}

export const ReplaceTag = (p: Parser, v: DatTag): Parser => ModifyDat(p, d => [Value(d), v, Remaining(d)]);
export const ModifyVal = (p: Parser, f: (d: DatValue) => DatValue): Parser => ModifyDat(p, d => [f(Value(d)), Tag(d), Remaining(d)]);
export const ReplaceVal = (p: Parser, v: DatValue): Parser => ModifyDat(p, d => [v, Tag(d), Remaining(d)]);
export const ConsumeAll = (p: Parser): Parser => str => {
    let res: Dat = p(str);
    return Remaining(res).length > 0 ? MkFail(str) : res;
}

export function RunComb(a: Dat, b: Dat, comb: Combiner): Dat {
    if (Failed(a) || Failed(b))
        return MkFail(Remaining(b));
    return comb(a, b);
}

export type Parser = (str: string) => Dat;

export const Always = (v: string): Parser => (str) => [v, "", str];

export const Not = (v: Parser): Parser => str => {
    let res: Dat = v(str);
    return [Success(res) ? Fail : "", "", Remaining(res)];
}


export function Then(a: Parser, b: Parser, comb: Combiner = DefComb): Parser {
    return (str) => {
        let aRes: Dat = a(str);
        if (Failed(aRes)) return MkFail(str);
        let bRes: Dat = b(Remaining(aRes));
        return RunComb(aRes, bRes, comb);
    };
}

export function ThenR(a: Parser, b: Parser, comb: Combiner = DefComb): Parser {
    return str => {
        if (str.length == 0) return MkFail(str);
        let skipped: string = "";
        let bRes: Dat = MkFail(str);
        for (let i = 1; i < str.length; i++) {
            bRes = b(str.slice(i));
            if (Success(bRes)) {
                skipped = str.slice(0, i);
                break;
            }
        }
        if (skipped === "" || Failed(bRes)) return MkFail(str);
        let aRes = ConsumeAll(a)(skipped);
        if (Failed(aRes)) return MkFail(str);
        return RunComb(aRes, bRes, comb);
    };
}

export function Or(a: Parser, b: Parser): Parser {
    return (str) => {
        let aRes: Dat = a(str);
        return Success(aRes) ? aRes : b(str);
    };
}

export function And(a: Parser, b: Parser, comb: Combiner = DefComb): Parser {
    return (str) => {
        let aRes: Dat = a(str);
        if (Failed(aRes)) return MkFail(str);
        let bRes: Dat = b(str);
        if (Failed(bRes)) return MkFail(str);
        return RunComb(aRes, bRes, comb);
    };
}

// Inclusive Or. You can have a then b or either a or b
export const EitherOr = (a: Parser, b: Parser, comb: Combiner = DefComb): Parser => Or(Then(a, b, comb), Or(a, b));

export function Chain(chain: Parser[], comb: Combiner = DefComb): Parser {
    return (str) => {
        if (chain.length == 0) return MkFail(str);
        if (chain.length == 1) return chain[0](str);
        return Then(chain[0], Chain(chain.slice(1), comb), comb)(str);
    };
}

export function ChainSelect(chain: Parser[], index: number = 0): Parser {
    return (str) => {
        if (chain.length == 0) return MkFail(str);
        if (chain.length == 1) return chain[0](str);
        return Then(chain[0], ChainSelect(chain.slice(1), index - 1), index == 0 ? LeftComb : RightComb)(str);
    };
}

export function OrChain(chain: Parser[]): Parser {
    return (str) => {
        if (chain.length == 0) return MkFail(str);
        if (chain.length == 1) return chain[0](str);
        return Or(chain[0], OrChain(chain.slice(1)))(str);
    };
}

export const OneOrNone = (p: Parser): Parser => Or(p, Always(""));

export const OneOrMany = (p: Parser, comb: Combiner = DefComb): Parser =>
    str => Or(Then(p, OneOrMany(p, comb), comb), p)(str);

export const NoneOrMany = (p: Parser, comb: Combiner = DefComb): Parser =>
    OneOrNone(OneOrMany(p, comb));

export const NoneOrManyUntil = (pa: Parser, pb: Parser, comb: Combiner = DefComb): Parser =>
    str => Or(pb, Then(pa, NoneOrManyUntil(pa, pb, comb), comb))(str);

export const OneOrManyUntil = (pa: Parser, pb: Parser, comb: Combiner = DefComb): Parser =>
    Then(pa, Or(pb, NoneOrManyUntil(pa, pb, comb)), comb);

export const Cap = (p: Parser): Parser => ModifyDat(p, d => [Value(d), "Base", ""]);

export function ReadCharF(predicate: (s: string) => boolean): Parser {
    return (str) => {
        if (str.length > 0 && predicate(str[0]))
            return [str[0], "", str.slice(1)];
        return MkFail(str);
    };
}

export const Chars = (chars: string[]): Parser =>
    (str) => ReadCharF((s) => chars.indexOf(s) >= 0)(str);

export const Char = (char: string): Parser => ReadCharF((s) => s === char);

export const Keyword = (word: string): Parser => word.length == 0 ? Always("") : Then(Char(word[0]), Keyword(word.slice(1)), StrComb);

export const Maybe = (v: string): Parser => Or(Char(v), Always(""));

export const AnyChar = ReadCharF((s) => true);

export const ConsumeUntil = (p: Parser, comb: Combiner = DefComb): Parser =>
    str => NoneOrManyUntil(AnyChar, p, comb)(str);

export const EscapedChar = And(Char("\\"), AnyChar);

export const Str = Then(Char('"'), NoneOrManyUntil(AnyChar, Char('"')));

export const Digit = Chars(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

// Shortest way I could think of to write 'Whitespace'
export const Air = Chars([" ", "\t", "\p", "\r"]);
export const Airs = NoneOrMany(Air);
export const Comma = Char(",");
export const Dot = Char(".");
export const Addition = Char("+");
export const Subtraction = Char("-");
export const Mult = Chars(["*"]);
export const Division = Char("/");
export const OpenParen = Chars(["(", "[", "{"]);
export const CloseParen = Chars([")", "]", "}"]);
export const Modulo = Char("%");

export const SurroundAir = (p: Parser) => Then(Airs, Then(p, Airs, LeftComb), RightComb);
export const ArgComma = SurroundAir(Comma);
export const ArgOpenParen = SurroundAir(OpenParen);
export const ArgCloseParen = SurroundAir(CloseParen);

export const Num =
    ModifyDat(
        EitherOr(OneOrMany(Or(Digit, Comma), StrComb), Then(Dot, OneOrMany(Digit, StrComb), StrComb), StrComb),
        d => [{ "c": +Value(d), "t": "Num" }, "", Remaining(d)]
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

export const InfixOp = (op: Parser, opTag: DatTag): Parser => str =>
    Then(
        ThenR(Exp(), Then(Airs, Then(op, Airs, LeftComb), RightComb), LeftComb),
        Exp(),
        (a, b) => [{ "c": opTag, "t": opTag, "l": Value(a), "r": Value(b) }, "", Remaining(b)]
    )(str);

export const ExpAdd = InfixOp(Addition, "+");
export const ExpMult = InfixOp(Mult, "*");
export const ExpSub = InfixOp(Subtraction, "-");
export const ExpDiv = InfixOp(Division, "/");
export const ExpPow = InfixOp(Char("^"), "^");

export const ExpFuncArgs = (): Parser => str =>
    Or(
        ThenR(Exp(), Then(ArgComma, ExpFuncArgs(), RightComb), RTreeComb("arg")),
        ModifyDat(Exp(),
            d => [{ "c": Value(d), "t": "arg", "r": { "c": null, "t": "argend" } }, "", Remaining(d)]
        ))(str);

export const ExpFunc = (funcName: string): Parser =>
    ModifyDat(ChainSelect([Airs, Keyword(funcName), Airs, OpenParen, Airs, ExpFuncArgs(), Airs, CloseParen, Airs], 5), d => [{ "c": Value(d), "t": "func", "func": funcName }, "", Remaining(d)]);

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

// console.log(Deno.inspect(Cap(Exp())(input), { colors: true, depth: 64 }));
console.log(RunBase(Cap(Exp())(input)));

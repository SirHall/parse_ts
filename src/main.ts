export const Fail = null;

export type Dat = [string | null, string];
// A combiner is a function that combines two output strings
export type Combiner = (aStr: string, bStr: string) => string;
export const DefComb: Combiner = (a, b) => a + b;

export const Success =   (n: Dat) => n[0] !== Fail
export const Failed =    (n: Dat) => !Success(n);
export const Value =     (n: Dat) => n[0] ?? "";
export const Remaining = (n: Dat) => n[1];

export function RunComb(a: Dat, b: Dat, comb: Combiner): Dat
{
    if (Failed(a) || Failed(b))
        return [Fail, Remaining(b)];
    return [comb(Value(a), Value(b)), Remaining(b)];
}

export type Parser = (str: string) => Dat;

export const Always = (v: string): Parser => str => [v, str];

export function Then(a: Parser, b: Parser, comb: Combiner = DefComb): Parser
{
    return str => {
        let aRes: Dat = a(str);
        if (Failed(aRes)) return [Fail, str];
        let bRes: Dat = b(Remaining(aRes));
        return RunComb(aRes, bRes, comb);
    };
}

export function Or(a: Parser, b: Parser): Parser
{
    return str => {
        let aRes: Dat = a(str);
        return Success(aRes) ? aRes : b(str);
    };
}

export function And(a: Parser, b: Parser, comb: Combiner = DefComb): Parser
{
    return str => {
        let aRes: Dat = a(str);
        if (Failed(aRes)) return [Fail, str];
        let bRes: Dat = b(str);
        if (Failed(bRes)) return [Fail, str];
        return RunComb(aRes, bRes, comb);
    };
}

// Inclusive Or
export const EitherOr = (a: Parser, b: Parser, comb: Combiner = DefComb): Parser => Or(Then(a, b, comb), Or(a, b));

export function Chain(chain: Parser[], comb: Combiner = DefComb): Parser
{
    return str => {
        if (chain.length == 0) return [Fail, str];
        if (chain.length == 1) return chain[0](str);
        return Then(chain[0], Chain(chain.slice(1), comb), comb)(str);
    };
}

export function OrChain(chain: Parser[]): Parser
{
    return str => {
        if (chain.length == 0) return [Fail, str];
        if (chain.length == 1) return chain[0](str);
        return Or(chain[0], OrChain(chain.slice(1)))(str);
    };
}

export const OneOrNone = (p: Parser): Parser => Or(p, Always(""));

export const OneOrMany = (p: Parser, comb: Combiner = DefComb): Parser => (str => Or(Then(p, OneOrMany(p, comb), comb), p)(str));

export const NoneOrMany = (p: Parser, comb: Combiner = DefComb): Parser => OneOrNone(OneOrMany(p, comb));

export const NoneOrManyUntil = (pa: Parser, pb: Parser, comb: Combiner = DefComb): Parser => str =>
    Or(pb, Then(pa, NoneOrManyUntil(pa, pb, comb), comb))(str);
    
export const OneOrManyUntil = (pa: Parser, pb: Parser, comb: Combiner = DefComb): Parser =>
    Then(pa, Or(pb, NoneOrManyUntil(pa, pb, comb)), comb);

export function ReadCharF(predicate: (s: string) => boolean): Parser
{
    return str => {
        if (str.length > 0 && predicate(str[0]))
            return [str[0], str.slice(1)];
        return [Fail, str];
    };
}



export const Chars = (chars: string[]): Parser => str => ReadCharF(s => chars.indexOf(s) >= 0)(str);

export const Char = (char: string): Parser => ReadCharF(s => s === char);

export const Maybe = (v: string): Parser => Or(Char(v), Always(""));

export const AnyChar = ReadCharF(s => true);

export const EscapedChar = And(Char('\\'), AnyChar);

export const Str = Then(Char('"'), NoneOrManyUntil(AnyChar, Char('"')));

export const Digit = Chars(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

// Shortest way I could think of to write 'Whitespace'
export const Air         = Chars([" ", "\t", "\n", "\r"]);
export const Airs        = NoneOrMany(Air);
export const Comma       = Char(",");
export const Dot         = Char(".");
export const Addition    = Char("+");
export const Subtraction = Char("-");
export const Mult        = Char("*");
export const Division    = Char("/");
export const OpenParen   = Char("(");
export const CloseParen  = Char(")");

export const Num = EitherOr(NoneOrMany(Or(Digit, Comma)), Then(Dot, NoneOrMany(Digit)));

// Expression
export const Exp = (): Parser => str => OneOrMany(OrChain([Num, Chain([OpenParen, Exp(), CloseParen]), ExpAdd()]))(str);

export const ExpAdd = (): Parser => str => Chain([Exp(), Airs, Addition, Airs, Exp()])(str);

console.log("One or None");
console.log(OneOrNone(Char("a"))("bc"));
console.log(OneOrNone(Char("a"))("abc"));
console.log(OneOrNone(Char("a"))("aabc"));
console.log(OneOrNone(Char("a"))("aaabc"));

console.log("One or Many");
console.log(OneOrMany(Char("a"))("bc"));
console.log(OneOrMany(Char("a"))("abc"));
console.log(OneOrMany(Char("a"))("aabc"));
console.log(OneOrMany(Char("a"))("aaabc"));

console.log("None or Many");
console.log(NoneOrMany(Char("a"))("bc"));
console.log(NoneOrMany(Char("a"))("abc"));
console.log(NoneOrMany(Char("a"))("aabc"));
console.log(NoneOrMany(Char("a"))("aaabc"));

console.log(Str('"Hello there" That was my string'));
console.log(Str('"H"'));
console.log(Str('""'));

console.log(Num("123,456.10203"));
console.log(Num("123456.10203"));
console.log(Num("123,456."));
console.log(Num("123,456"));
console.log(Num(".10203"));
console.log(Num(".")); // This also evaluates to a number

console.log(Exp()("1.23 + 456 + (45 + 0.96)"));
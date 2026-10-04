import type { Result } from "@incantly/core";
import type { AstNode, Expression, ExpressionId } from "./types.js";
import { makeDiagnostic } from "./diagnostics.js";

class ParseFailure extends Error { constructor(message: string, readonly start: number, readonly end: number) { super(message); } }
class Parser {
  private position = 0;
  constructor(private readonly source: string) {}
  parse(): Result<Expression> { try { const definition = this.source.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*/); if (definition) this.position = definition[0].length; const ast = this.additive(); this.skipSpace(); if (this.position !== this.source.length) throw new ParseFailure("Unexpected token", this.position, this.position + 1); return { ok: true, value: { id: `${this.source.length}:${this.source}` as ExpressionId, source: this.source, ast, ...(definition?.[1] ? { definition: definition[1] } : {}) }, diagnostics: [] }; } catch (error) { const failure = error instanceof ParseFailure ? error : new ParseFailure("Invalid expression", this.position, this.position + 1); return { ok: false, diagnostics: [makeDiagnostic("parse_error", "parse", failure.message, { start: failure.start, end: failure.end }, "Complete the expression before evaluating it.")] }; }
  }
  private skipSpace(): void { while (/\s/.test(this.source[this.position] ?? "")) this.position += 1; }
  private match(token: string): boolean { this.skipSpace(); if (this.source.slice(this.position, this.position + token.length) !== token) return false; this.position += token.length; return true; }
  private additive(): AstNode { let node = this.multiplicative(); while (true) { const start = node.start; const op = this.match("+") ? "+" : this.match("-") ? "-" : null; if (!op) return node; const right = this.multiplicative(); node = { kind: "binary", op, left: node, right, start, end: right.end }; } }
  private multiplicative(): AstNode { let node = this.unary(); while (true) { const start = node.start; const op = this.match("*") ? "*" : this.match("/") ? "/" : this.implicitProduct() ? "*" : null; if (!op) return node; const right = this.unary(); node = { kind: "binary", op, left: node, right, start, end: right.end }; } }
  private implicitProduct(): boolean { this.skipSpace(); return /[A-Za-z_(]/.test(this.source[this.position] ?? ""); }
  private power(): AstNode { const left = this.primary(); if (!this.match("^")) return left; const right = this.unary(); return { kind: "binary", op: "^", left, right, start: left.start, end: right.end }; }
  private unary(): AstNode { this.skipSpace(); const start = this.position; if (this.match("-")) { const value = this.unary(); return { kind: "unary", op: "-", value, start, end: value.end }; } return this.power(); }
  private primary(): AstNode {
    this.skipSpace();
    const start = this.position;
    const number = this.source.slice(start).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) { this.position += number[0].length; return { kind: "number", value: Number(number[0]), start, end: this.position }; }
    const identifier = this.source.slice(start).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      this.position += identifier[0].length;
      if (this.match("(")) return { kind: "call", name: identifier[0], args: this.arguments(")"), start, end: this.position };
      return { kind: "name", value: identifier[0], start, end: this.position };
    }
    if (this.match("(")) {
      const values = this.arguments(")");
      if (values.length === 1) return values[0]!;
      if (values.length === 2) return { kind: "tuple", values, start, end: this.position };
      throw new ParseFailure("A point requires exactly two coordinates", start, this.position);
    }
    if (this.match("[")) return { kind: "list", values: this.arguments("]"), start, end: this.position };
    throw new ParseFailure("Expected a number, variable, point, list or function", start, start + 1);
  }
  private arguments(close: ")" | "]"): readonly AstNode[] {
    const values: AstNode[] = [];
    if (this.match(close)) return values;
    do { values.push(this.additive()); } while (this.match(","));
    if (!this.match(close)) throw new ParseFailure(`Expected '${close}'`, this.position, this.position + 1);
    return values;
  }
}
export const parseExpression = (source: string): Result<Expression> => new Parser(source).parse();

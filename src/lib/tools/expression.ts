/**
 * A small arithmetic evaluator for the calculator tool.
 *
 * **Deliberately not `eval` or `new Function`.** The input to this comes from
 * a language model, which in turn is influenced by whatever a user typed — so
 * it is untrusted by construction. Handing that to a JavaScript evaluator
 * would be remote code execution behind two layers of indirection. This is a
 * hand-written shunting-yard parser that understands numbers, five operators,
 * parentheses and a fixed function list, and can express nothing else.
 *
 * No dependency either: a maths-expression library would be more capable and
 * would also be a supply-chain surface for the one place in this codebase
 * that evaluates model-influenced input.
 */

type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'paren'; value: '(' | ')' } | { type: 'fn'; value: string };

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  log: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
const RIGHT_ASSOCIATIVE = new Set(['^']);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const text = input.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');

  while (i < text.length) {
    const char = text[i];

    if (/[0-9.]/.test(char)) {
      const match = /^[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?/.exec(text.slice(i));
      if (!match) throw new Error(`Cannot read a number at position ${i}.`);
      tokens.push({ type: 'num', value: Number(match[0]) });
      i += match[0].length;
      continue;
    }

    if (/[a-z]/i.test(char)) {
      const match = /^[a-z]+/i.exec(text.slice(i))!;
      const name = match[0].toLowerCase();
      if (name === 'pi') tokens.push({ type: 'num', value: Math.PI });
      else if (name === 'e') tokens.push({ type: 'num', value: Math.E });
      else if (name in FUNCTIONS) tokens.push({ type: 'fn', value: name });
      else throw new Error(`Unknown name "${name}".`);
      i += match[0].length;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i += 1;
      continue;
    }

    if (char in PRECEDENCE) {
      // A leading '-' (or one after an operator/open paren) is negation, not
      // subtraction. Rewritten as 0 - x so the rest of the parser needs no
      // special case for unary operators.
      const previous = tokens[tokens.length - 1];
      const isUnary = char === '-' && (!previous || previous.type === 'op' || (previous.type === 'paren' && previous.value === '('));
      if (isUnary) tokens.push({ type: 'num', value: 0 });
      tokens.push({ type: 'op', value: char });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character "${char}".`);
  }

  return tokens;
}

export function evaluateExpression(input: string): number {
  if (input.length > 200) throw new Error('Expression is too long.');

  const output: Token[] = [];
  const stack: Token[] = [];

  for (const token of tokenize(input)) {
    if (token.type === 'num') {
      output.push(token);
    } else if (token.type === 'fn') {
      stack.push(token);
    } else if (token.type === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1];
        const higher =
          top.type === 'fn' ||
          (top.type === 'op' &&
            (PRECEDENCE[top.value] > PRECEDENCE[token.value] ||
              (PRECEDENCE[top.value] === PRECEDENCE[token.value] && !RIGHT_ASSOCIATIVE.has(token.value))));
        if (!higher) break;
        output.push(stack.pop()!);
      }
      stack.push(token);
    } else if (token.value === '(') {
      stack.push(token);
    } else {
      while (stack.length && !(stack[stack.length - 1].type === 'paren')) output.push(stack.pop()!);
      if (!stack.length) throw new Error('Unbalanced parentheses.');
      stack.pop();
      if (stack.length && stack[stack.length - 1].type === 'fn') output.push(stack.pop()!);
    }
  }

  while (stack.length) {
    const token = stack.pop()!;
    if (token.type === 'paren') throw new Error('Unbalanced parentheses.');
    output.push(token);
  }

  const values: number[] = [];
  for (const token of output) {
    if (token.type === 'num') {
      values.push(token.value);
    } else if (token.type === 'fn') {
      const x = values.pop();
      if (x === undefined) throw new Error('Missing argument.');
      values.push(FUNCTIONS[token.value](x));
    } else if (token.type === 'op') {
      const b = values.pop();
      const a = values.pop();
      if (a === undefined || b === undefined) throw new Error('Malformed expression.');
      switch (token.value) {
        case '+': values.push(a + b); break;
        case '-': values.push(a - b); break;
        case '*': values.push(a * b); break;
        case '/':
          if (b === 0) throw new Error('Division by zero.');
          values.push(a / b);
          break;
        case '%':
          if (b === 0) throw new Error('Division by zero.');
          values.push(a % b);
          break;
        case '^': values.push(a ** b); break;
      }
    }
  }

  if (values.length !== 1) throw new Error('Malformed expression.');
  const result = values[0];
  if (!Number.isFinite(result)) throw new Error('Result is not a finite number.');
  return result;
}

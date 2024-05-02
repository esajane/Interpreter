class Token {
  constructor(type, value) {
    this.type = type;
    this.value = value;
  }

  toString() {
    return `Token(${this.type}, ${this.value})`;
  }
}

class Lexer {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.currentChar = this.input[0];
    this.keywords = [
      "BEGIN",
      "END",
      "CODE",
      "INT",
      "CHAR",
      "BOOL",
      "FLOAT",
      "STRING",
      "DISPLAY",
      "SCAN",
      "AND",
      "OR",
      "NOT",
      "IF",
      "ELSE",
    ];
    this.symbols = [
      "=",
      ",",
      "'",
      "#",
      "$",
      "&",
      "[",
      "]",
      ":",
      "+",
      "-",
      "*",
      "/",
      "%",
      "<",
      ">",
      "!",
      "(",
      ")",
    ];
    this.multiCharSymbols = ["<=", ">=", "==", "<>", "&&", "||"];
  }

  advance(n = 1) {
    this.position += n;
    if (this.position > this.input.length) {
      this.currentChar = undefined;
    } else {
      this.currentChar = this.input[this.position];
    }
  }

  peek() {
    const peekPos = this.position + 1;
    if (peekPos > this.input.length - 1) return undefined;
    else return this.input[peekPos];
  }

  peekToken() {
    const currentPosition = this.position;
    const currentChar = this.currentChar;
    this.advance();
    const nextToken = this.getNextToken();
    this.position = currentPosition;
    this.currentChar = currentChar;
    return nextToken;
  }

  skipWhitespace() {
    while (/[^\S\n]/.test(this.currentChar)) {
      this.advance();
    }
  }

  isAlphaNumeric(char) {
    return /[a-zA-Z0-9_]/.test(char);
  }

  isNumeric(char) {
    return /[0-9]/.test(char);
  }

  isFloat(char) {
    return /[0-9.]/.test(char);
  }

  getNextToken() {
    while (this.currentChar !== undefined) {
      if (/[^\S\n]/.test(this.currentChar)) {
        this.skipWhitespace();
        continue;
      }

      if (this.currentChar === "#") {
        while (this.currentChar !== "\n" && this.currentChar !== undefined) {
          this.advance();
        }
        this.advance();
        continue;
      }

      if (this.currentChar === "\n") {
        this.advance();
        return new Token("EOL", "\n");
      }

      if (this.currentChar === "$") {
        this.advance();
        return new Token("NEWLINE", "$");
      }

      if (this.currentChar === "&") {
        this.advance();
        return new Token("CONCAT", "&");
      }

      if (this.currentChar === "[") {
        let value = this.currentChar;
        this.advance();
        value += this.currentChar;
        this.advance();
        value += this.currentChar;
        this.advance();
        return new Token("ESCAPE", value);
      }

      if (this.currentChar === "'" || this.currentChar === '"') {
        let value = "";
        const quote = this.currentChar;
        this.advance();
        while (this.currentChar !== quote) {
          if (this.currentChar === undefined) {
            throw new Error(`Unclosed string: ${quote}`);
          }
          value += this.currentChar;
          this.advance();
        }
        this.advance();
        return new Token("STRING", value);
      }

      if (this.isNumeric(this.currentChar)) {
        let value = "";
        let isFloat = false;
        let dotCount = 0; // Track the number of dots
        while (this.isNumeric(this.currentChar) || this.currentChar === ".") {
          if (this.currentChar === ".") {
            if (isFloat || dotCount > 0) {
              // Check if there is already a dot
              throw new Error(`Multiple decimal points in float`);
            }
            isFloat = true;
            dotCount++;
          }
          value += this.currentChar;
          this.advance();
        }
        if (isFloat) {
          return new Token("NUMBER", parseFloat(value));
        }
        return new Token("NUMBER", parseInt(value));
      }

      if (this.isAlphaNumeric(this.currentChar)) {
        let value = "";
        while (this.isAlphaNumeric(this.currentChar)) {
          if (this.currentChar === undefined) break;
          value += this.currentChar;
          this.advance();
        }
        if (value === "true" || value === "false") {
          return new Token("BOOLEAN", value == "true"); // Converts string to boolean
        } else if (this.keywords.includes(value)) {
          return new Token("KEYWORD", value);
        } else {
          return new Token("IDENTIFIER", value);
        }
      }

      if (this.multiCharSymbols.includes(`${this.currentChar}${this.peek()}`)) {
        const value = `${this.currentChar}${this.peek()}`;
        this.advance(2);
        return new Token("SYMBOL", value);
      }

      if (this.symbols.includes(this.currentChar)) {
        const value = this.currentChar;
        this.advance();
        return new Token("SYMBOL", value);
      }

      throw new Error(`Unexpected character: ${this.currentChar}`);
    }

    return new Token("EOF", "");
  }
}

module.exports = { Lexer };

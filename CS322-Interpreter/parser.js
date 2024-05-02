const { Lexer } = require("./lexer");

class ASTNode {
  constructor(type) {
    this.type = type;
  }
}

class Parser {
  constructor(input) {
    this.lexer = new Lexer(input);
    this.currentToken = this.lexer.getNextToken();
    this.variableDeclarationKeywords = new Set([
      "INT",
      "CHAR",
      "BOOL",
      "FLOAT",
      "STRING",
    ]);
  }

  eat(tokenType, expectedValue = null) {
    if (
      this.currentToken.type === tokenType &&
      (expectedValue === null ||
        this.currentToken.value.toUpperCase() === expectedValue.toUpperCase())
    ) {
      // console.log(
      //   `Token consumed: ${this.currentToken.type} '${this.currentToken.value}'`
      // );
      this.currentToken = this.lexer.getNextToken();
    } else {
      throw new Error(
        `Syntax error: Expected token ${tokenType} '${expectedValue}' but found ${this.currentToken.type} '${this.currentToken.value}'`
      );
    }
  }

  eatEOL() {
    this.eat("EOL");
    while (this.currentToken.type === "EOL") {
      this.eat("EOL");
    }
  }

  parse() {
    return this.program();
  }

  // CFG: <program> ::= 'BEGIN' 'CODE' <variableDeclarations> <statements> 'END' 'CODE'
  program() {
    this.eat("KEYWORD", "BEGIN");
    this.eat("KEYWORD", "CODE");
    this.eatEOL();

    const declarations = [];
    const statements = [];
    let statementStarted = false; // Flag to prevent declarations after statements

    while (this.currentToken.value !== "END") {
      if (this.variableDeclarationKeywords.has(this.currentToken.value)) {
        if (statementStarted) {
          throw new Error(
            "No variable declarations allowed after statements have started."
          );
        }
        declarations.push(...this.variableDeclarations());
      } else {
        statementStarted = true;
        if (
          ["DISPLAY", "SCAN", "IF", "ELSE"].includes(this.currentToken.value)
        ) {
          statements.push(...this.statements());
        } else if (this.currentToken.type === "IDENTIFIER") {
          // Check if it's a reassignment or other kind of statement
          const variableName = this.currentToken.value;
          this.eat("IDENTIFIER");
          if (
            this.currentToken.type === "SYMBOL" &&
            this.currentToken.value === "="
          ) {
            const reassignmentStatement =
              this.parseReassignmentStatement(variableName);
            statements.push(reassignmentStatement);
          } else {
            throw new Error(
              `Unexpected token: ${this.currentToken.type} '${this.currentToken.value}', expected '=' for assignment.`
            );
          }
        } else {
          throw new Error(
            `Unexpected token: ${this.currentToken.type} '${this.currentToken.value}', expected declaration, statement, or 'END'`
          );
        }
      }
    }
    this.eat("KEYWORD", "END");
    this.eat("KEYWORD", "CODE");
    if (this.currentToken.type === "EOL") this.eatEOL();
    if (this.currentToken.type !== "EOF") {
      throw new Error(
        `Unexpected token after 'END CODE': ${this.currentToken.toString()}`
      );
    }
    return new ProgramNode(declarations, statements);
  }

  // CFG: <variableDeclarations> ::= (<variableDeclaration> $)*
  variableDeclarations() {
    const declarations = [];
    let lastType = null;
    while (
      this.currentToken.type === "KEYWORD" &&
      this.variableDeclarationKeywords.has(this.currentToken.value)
    ) {
      const type = this.currentToken.value;

      // Chect for Duplicates
      if (lastType === type) {
        throw new Error(`Syntax error: Duplicate '${type}' keyword found.`);
      }

      this.eat("KEYWORD");
      this.parseDeclarations(type, declarations);
      lastType = type;

      if (this.lexer.peekToken().value !== ",") {
        lastType = null;
      }

      this.eatEOL();
    }
    return declarations;
  }

  parseDeclarations(type, declarations) {
    if (this.currentToken.type !== "IDENTIFIER") {
      throw new Error(
        `Syntax error: Expected identifier after '${type}' keyword instead got ${this.currentToken.toString()}`
      );
    }
    while (this.currentToken.type === "IDENTIFIER") {
      const variableName = this.currentToken.value;
      this.eat("IDENTIFIER");
      const value = this.parseAssignment();

      declarations.push(new VariableDeclarationNode(type, variableName, value));

      if (
        this.currentToken.type === "SYMBOL" &&
        this.currentToken.value === ","
      ) {
        this.eat("SYMBOL"); // Eat comma if present
        if (this.currentToken.type !== "IDENTIFIER") {
          throw new Error(
            `Syntax error: Expected identifier after ',' in variable declaration instead got ${this.currentToken.toString()}`
          );
        }
      } else {
        break; // Exit loop if no comma, end of declaration
      }
    }
  }

  parseAssignment() {
    let value = null;
    if (
      this.currentToken.type === "SYMBOL" &&
      this.currentToken.value === "="
    ) {
      this.eat("SYMBOL");

      if (
        ["NUMBER", "IDENTIFIER"].includes(this.currentToken.type) ||
        ["(", "+", "-", "NOT"].includes(this.currentToken.value)
      ) {
        value = this.parseExpression();
      } else {
        if (this.currentToken.value === "TRUE") {
          value = true;
        } else if (this.currentToken.value === "FALSE") {
          value = false;
        } else {
          value = this.currentToken.value;
        }
        this.eat(this.currentToken.type);
      }

      while (
        this.currentToken.type === "SYMBOL" &&
        this.currentToken.value === "="
      ) {
        this.eat("SYMBOL");

        let nextValue = null;
        if (this.lexer.peekToken().value === "=") {
          nextValue = this.currentToken.value;
          this.eat(this.currentToken.type);
        } else if (
          ["NUMBER", "IDENTIFIER"].includes(this.currentToken.type) ||
          (this.currentToken.type === "SYMBOL" &&
            this.currentToken.value === "(")
        ) {
          nextValue = this.parseExpression();
        } else {
          nextValue = this.currentToken.value;
          this.eat(this.currentToken.type);
        }

        if (value.type === "AssignmentStatement") {
          value.expression = new AssignmentStatementNode(
            value.expression,
            nextValue
          );
        } else {
          value = new AssignmentStatementNode(value.name, nextValue);
        }
      }
    }
    return value;
  }

  parseReassignmentStatement(variableName) {
    let value = null;
    this.eat("SYMBOL", "=");
    if (
      ["NUMBER", "IDENTIFIER"].includes(this.currentToken.type) ||
      ["(", "+", "-", "NOT"].includes(this.currentToken.value)
    ) {
      value = this.parseExpression();
    } else {
      if (this.currentToken.value === "TRUE") {
        value = true;
      } else if (this.currentToken.value === "FALSE") {
        value = false;
      } else {
        value = this.currentToken.value;
      }
      this.eat(this.currentToken.type);
    }

    while (
      this.currentToken.type === "SYMBOL" &&
      this.currentToken.value === "="
    ) {
      this.eat("SYMBOL");

      let nextValue = null;
      if (this.lexer.peekToken().value === "=") {
        console.log("Detected chained assignment.", this.currentToken.value);
        nextValue = this.currentToken.value;
        this.eat(this.currentToken.type);
      } else if (
        ["NUMBER", "IDENTIFIER"].includes(this.currentToken.type) ||
        (this.currentToken.type === "SYMBOL" && this.currentToken.value === "(")
      ) {
        nextValue = this.parseExpression();
      } else {
        nextValue = this.currentToken.value;
        this.eat(this.currentToken.type);
      }

      if (value.type === "ReassignmentStatement") {
        let name = value.value;
        while (typeof name === "object") {
          name = name.name;
        }

        value.value = new ReassignmentNode(name, nextValue);
      } else {
        value = new ReassignmentNode(value.name, nextValue);
      }
    }

    this.eatEOL();

    return new ReassignmentNode(variableName, value);
  }

  // CFG: <statements> ::= (<statement>)*
  statements() {
    const statements = [];
    while (
      this.currentToken.type !== "EOF" &&
      this.currentToken.value !== "END"
    ) {
      if (
        this.currentToken.type === "IDENTIFIER" &&
        this.lexer.peekToken().value === "="
      ) {
        console.log(`Detected assignment statement start.`);
        const variableName = this.currentToken.value;
        this.eat("IDENTIFIER");
        statements.push(this.parseReassignmentStatement(variableName));
      } else if (
        this.variableDeclarationKeywords.has(
          this.currentToken.value.toUpperCase()
        )
      ) {
        throw new Error(
          `Unexpected variable declaration inside statements block: ${this.currentToken.toString()}`
        );
      } else {
        statements.push(this.statement());
      }
    }
    return statements;
  }

  // CFG: <statement> ::= <displayStatement>
  statement() {
    const validStatementStarters = ["DISPLAY", "SCAN", "IF", "ELSE"];
    if (
      !validStatementStarters.includes(this.currentToken.value) &&
      this.currentToken.type !== "IDENTIFIER"
    ) {
      throw new Error(
        `Unexpected token for statement start: ${this.currentToken.value}`
      );
    }

    // Existing switch-case logic for handling recognized statements
    switch (this.currentToken.value) {
      case "DISPLAY":
        return this.displayStatement();
      case "SCAN":
        return this.scanStatement();
      case "IF":
      case "ELSE":
        return this.conditionalStatement();
      default:
        if (this.currentToken.type === "IDENTIFIER") {
          const variableName = this.currentToken.value;
          this.eat("IDENTIFIER");
          return this.parseReassignmentStatement(variableName);
        }
        throw new Error(
          `Unsupported statement type: ${this.currentToken.value}`
        );
    }
  }

  conditionalStatement() {
    this.eat("KEYWORD", "IF");
    const condition = this.parseExpression();
    this.eatEOL();
    this.eat("KEYWORD", "BEGIN");
    this.eat("KEYWORD", "IF");
    this.eatEOL();
    const ifBlock = this.statements();
    this.eat("KEYWORD", "END");
    this.eat("KEYWORD", "IF");
    this.eatEOL();
    const elseIfBlocks = [];
    let elseBlock = null;

    // else if
    while (
      this.currentToken.value === "ELSE" &&
      this.lexer.peekToken().value === "IF"
    ) {
      this.eat("KEYWORD", "ELSE");
      this.eat("KEYWORD", "IF");
      const condition = this.parseExpression();
      this.eatEOL();
      this.eat("KEYWORD", "BEGIN");
      this.eat("KEYWORD", "IF");
      this.eatEOL();
      const statements = this.statements();
      elseIfBlocks.push({ condition, statements });
      this.eat("KEYWORD", "END");
      this.eat("KEYWORD", "IF");
      this.eatEOL();
    }

    // else
    if (this.currentToken.value === "ELSE") {
      this.eat("KEYWORD", "ELSE");
      this.eatEOL();
      this.eat("KEYWORD", "BEGIN");
      this.eat("KEYWORD", "IF");
      this.eatEOL();
      elseBlock = this.statements();
      this.eat("KEYWORD", "END");
      this.eat("KEYWORD", "IF");
      this.eatEOL();
    }

    return new ConditionalStatementNode(
      condition,
      ifBlock,
      elseIfBlocks,
      elseBlock
    );
  }

  // CFG: <displayStatement> ::= ['DISPLAY' ':'] (<part>)*
  displayStatement() {
    this.eat("KEYWORD", "DISPLAY");
    this.eat("SYMBOL", ":");
    const parts = [];

    // const expression = this.parseExpression(); // This will handle the entire expression, including parentheses
    // parts.push(expression);
    while (true) {
      if (this.currentToken.type === "STRING") {
        parts.push(new LiteralNode(this.currentToken.value));
        this.eat("STRING");
      } else if (
        ["NUMBER", "IDENTIFIER"].includes(this.currentToken.type) ||
        ["(", "+", "-", "NOT"].includes(this.currentToken.value)
      ) {
        parts.push(this.parseExpression());
      } else if (this.currentToken.type === "CONCAT") {
        parts.push({ type: "CONCAT", value: "&" });
        this.eat("CONCAT");
      } else if (this.currentToken.type === "NEWLINE") {
        parts.push({ type: "NEWLINE", value: "$" });
        this.eat("NEWLINE");
      } else if (this.currentToken.type === "ESCAPE") {
        const escapeValue = this.currentToken.value;
        const escapedCharacter = escapeValue.substring(
          1,
          escapeValue.length - 1
        );
        parts.push({ type: "ESCAPE", value: escapedCharacter });
        this.eat("ESCAPE");
      } else {
        break;
      }
    }
    this.eatEOL();
    return new DisplayStatementNode(parts);
  }

  // CFG <scanStatement> ::= 'SCAN' ':' <variableName> (',' <variableName>)*
  scanStatement() {
    this.eat("KEYWORD", "SCAN");
    this.eat("SYMBOL", ":");
    const variableNames = [];
    do {
      const variableName = this.currentToken.value;
      variableNames.push(variableName);
      this.eat("IDENTIFIER");
      if (
        this.currentToken.type === "SYMBOL" &&
        this.currentToken.value === ","
      ) {
        this.eat("SYMBOL");
      } else {
        break;
      }
    } while (this.currentToken.type === "IDENTIFIER");
    this.eatEOL();
    return new ScanStatementNode(variableNames);
  }

  assignmentStatement() {
    console.log(`Parsing assignment statement.`);
    const variableName = this.currentToken.value;
    this.eat("IDENTIFIER");
    this.eat("SYMBOL", "=");
    console.log(
      `Parsing expression in assignment to: ${variableName} with current Token: ${this.currentToken.toString()}`
    );
    const expr = this.parseExpression();
    return new AssignmentStatementNode(variableName, expr);
  }

  parseFactor() {
    if (
      this.currentToken.type === "KEYWORD" &&
      this.currentToken.value === "NOT"
    ) {
      this.eat("KEYWORD", "NOT");
      const operand = this.parseFactor();
      return new UnaryOperationNode("NOT", operand);
    }
    if (this.currentToken.type === "NUMBER") {
      const value = this.currentToken.value;
      this.eat("NUMBER");
      return new LiteralNode(value);
    } else if (
      this.currentToken.type === "SYMBOL" &&
      this.currentToken.value === "("
    ) {
      this.eat("SYMBOL", "(");
      const node = this.parseExpression();
      this.eat("SYMBOL", ")");
      return node;
    }
    if (this.currentToken.type === "FLOAT") {
      const value = parseFloat(this.currentToken.value);
      this.eat("FLOAT");
      return new LiteralNode(value); // Assuming LiteralNode can handle float values
    }

    if (this.currentToken.type === "IDENTIFIER") {
      const varName = this.currentToken.value;
      this.eat("IDENTIFIER");
      return new IdentifierNode(varName); // Ensure this path is correctly handled
    } else if (this.currentToken.type === "STRING") {
      const value = this.currentToken.value;
      this.eat("STRING");
      return new LiteralNode(value);
    } else if (
      this.currentToken.type === "SYMBOL" &&
      ["+", "-"].includes(this.currentToken.value)
    ) {
      const operator = this.currentToken.value;
      this.eat("SYMBOL");
      const operand = this.parseFactor();
      return new UnaryOperationNode(operator, operand);
    } else {
      throw new Error(
        "Unexpected token in parseFactor: " + this.currentToken.type
      );
    }
  }

  parseTerm() {
    let node = this.parseFactor();
    while (["*", "/"].includes(this.currentToken.value)) {
      const operator = this.currentToken.value;
      this.eat("SYMBOL", operator);
      node = new BinaryOperationNode(operator, node, this.parseFactor());
    }
    return node;
  }

  parseExpression() {
    let node = this.parseLogicalExpression(); // Start with the highest level of expression parsing
    return node;
  }

  parseLogicalExpression() {
    let node = this.parseComparison();
    while (["AND", "OR"].includes(this.currentToken.value.toUpperCase())) {
      const operator = this.currentToken.value.toUpperCase();
      this.eat("KEYWORD", operator);
      node = new BinaryOperationNode(operator, node, this.parseComparison());
    }
    return node;
  }

  parseComparison() {
    let node = this.parseArithmeticExpression();
    while (
      ["<", ">", "<=", ">=", "==", "<>"].includes(this.currentToken.value)
    ) {
      const operator = this.currentToken.value;
      this.eat("SYMBOL", operator);
      node = new BinaryOperationNode(
        operator,
        node,
        this.parseArithmeticExpression()
      ); // You may need a separate method for arithmetic to keep precedence correct
    }
    return node;
  }

  parseArithmeticExpression() {
    let node = this.parseTerm();
    while (["+", "-"].includes(this.currentToken.value)) {
      const operator = this.currentToken.value;
      this.eat("SYMBOL", operator);
      node = new BinaryOperationNode(operator, node, this.parseTerm());
    }
    return node;
  }
}

class ProgramNode extends ASTNode {
  constructor(declarations, statements) {
    super("Program");
    this.declarations = declarations;
    this.statements = statements;
  }
}

class VariableDeclarationNode extends ASTNode {
  constructor(type, name, value) {
    super("VariableDeclaration");
    this.type = type;
    this.name = name;
    this.value = value; // value can be a LiteralNode or null
  }
}

class ReassignmentNode extends ASTNode {
  constructor(variableName, value) {
    super("ReassignmentStatement");
    this.name = variableName;
    this.value = value;
  }
}

class DisplayStatementNode extends ASTNode {
  constructor(parts) {
    super("DisplayStatement");
    this.parts = parts;
  }
}

class ScanStatementNode extends ASTNode {
  constructor(variableNames) {
    super("ScanStatement");
    this.variableNames = variableNames;
  }
}

class ConditionalStatementNode extends ASTNode {
  constructor(condition, ifBlock, elseIfBlocks = [], elseBlock = null) {
    super("ConditionalStatement");
    this.condition = condition;
    this.ifBlock = ifBlock;
    this.elseIfBlocks = elseIfBlocks;
    this.elseBlock = elseBlock;
  }
}

class IdentifierNode extends ASTNode {
  constructor(name) {
    super("IDENTIFIER");
    this.name = name;
  }
}

class LiteralNode extends ASTNode {
  constructor(value) {
    super("Literal");
    this.value = value;
  }
}

class BinaryOperationNode extends ASTNode {
  constructor(operator, left, right) {
    super("BinaryOperation");
    this.operator = operator;
    this.left = left;
    this.right = right;
  }
}

class UnaryOperationNode extends ASTNode {
  constructor(operator, operand) {
    super("UnaryOperation");
    this.operator = operator;
    this.operand = operand;
  }
}

class AssignmentStatementNode extends ASTNode {
  constructor(variableName, expression) {
    super("AssignmentStatement");
    this.variableName = variableName;
    this.expression = expression;
  }
}

module.exports = {
  Parser,
  ProgramNode,
  VariableDeclarationNode,
  ReassignmentNode,
  DisplayStatementNode,
  ScanStatementNode,
  AssignmentStatementNode,
  BinaryOperationNode,
  UnaryOperationNode,
  IdentifierNode,
  LiteralNode,
};

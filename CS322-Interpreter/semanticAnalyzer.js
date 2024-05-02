const {
  BinaryOperationNode,
  IdentifierNode,
  VariableDeclarationNode,
  LiteralNode,
} = require("./parser");

class SemanticAnalyzer {
  constructor(ast) {
    this.ast = ast;
    this.errors = [];
    this.reservedSymbols = [
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
    this.symbolTable = {}; // track sa variables
  }

  analyze() {
    this.visitNode(this.ast);
    this.report();
    return { pass: this.errors.length === 0, ast: this.ast }; // return ug true if no errors
  }

  visitNode(node) {
    switch (node.type) {
      case "Program":
        this.analyzeProgram(node);
        break;
      // Variable declaration nodes
      case "INT":
      case "CHAR":
      case "BOOL":
      case "FLOAT":
        this.analyzeVariableDeclaration(node);
        break;
      case "ReassignmentStatement":
        this.analyzeReassignmentStatement(node);
        break;
      case "AssignmentStatement":
        this.analyzeAssignmentStatement(node);
        break;
      case "DisplayStatement":
        this.analyzeDisplayStatement(node);
        break;
      case "ScanStatement":
        this.analyzeScanStatement(node);
        break;
      case "ConditionalStatement":
        this.analyzeConditionalStatement(node);
        break;
      default:
        break;
    }
  }

  analyzeConditionalStatement(node) {
    this.analyzeExpression(node.condition);
    node.ifBlock.forEach((statement) => this.visitNode(statement));
    node.elseIfBlocks.forEach((elseIfBlock) => {
      this.analyzeExpression(elseIfBlock.condition);
      elseIfBlock.statements.forEach((statement) => this.visitNode(statement));
    });
    if (node.elseBlock) {
      node.elseBlock.forEach((statement) => this.visitNode(statement));
    }
  }

  analyzeProgram(programNode) {
    programNode.declarations.forEach((declaration) =>
      this.visitNode(declaration)
    );
    programNode.statements.forEach((statement) => this.visitNode(statement));
  }

  analyzeVariableDeclaration(declarationNode) {
    const variableName = declarationNode.name;
    const variableType = declarationNode.type;
    let variableValue = declarationNode.value;
    const isInitialized = variableValue !== null; // check if naa value

    if (this.symbolTable[variableName]) {
      this.errors.push(`Variable '${variableName}' is already declared.`);
    } else {
      if (variableValue instanceof LiteralNode) {
        if (
          variableType === "FLOAT" &&
          !isNaN(parseFloat(variableValue.value))
        ) {
          variableValue = parseFloat(variableValue.value); // Convert string to float
        } else if (
          variableType === "INT" &&
          Number.isInteger(parseInt(variableValue.value))
        ) {
          variableValue = parseInt(variableValue.value); // Ensure integer values are stored as numbers
        }
      }
      if (variableValue instanceof IdentifierNode) {
        if (!this.symbolTable[variableValue.name]) {
          this.errors.push(
            `Undeclared variable '${variableValue.name}' used in expression.`
          );
          return;
        } else if (!this.symbolTable[variableValue.name].initialized) {
          this.errors.push(
            `Uninitialized variable '${variableValue.name}' used in expression.`
          );
          return;
        } else {
          this.ast.declarations.forEach((declaration) => {
            if (declaration.name === variableName) {
              declaration.value = this.symbolTable[variableValue.name].value;
              variableValue = declaration.value;
            }
          });
        }
      }

      if (variableType === "BOOL" && typeof variableValue === "string") {
        if (variableValue.toLowerCase() === "true") {
          variableValue = true;
        } else if (variableValue.toLowerCase() === "false") {
          variableValue = false;
        }
      }

      if (
        isInitialized &&
        !this.checkTypeCompatibility(variableType, variableValue)
      ) {
        if (variableValue.type === "AssignmentStatement") {
          variableValue = this.analyzeAssignmentStatement(variableValue);
          this.ast.declarations.forEach((declaration) => {
            if (declaration.name === variableName) {
              declaration.value = variableValue;
            }
          });

          this.symbolTable[variableName] = {
            type: variableType,
            value: variableValue,
            initialized: isInitialized,
          };
          return;
        }
        const type = typeof variableValue; //make it UpperCase
        const type1 = type.toUpperCase();
        this.errors.push(
          `Type mismatch in initialization of '${variableName}': cannot assign ${
            type1 === "OBJECT" ? variableValue.type : type1
          } to ${variableType}.`
        );
      } else {
        this.symbolTable[variableName] = {
          type: variableType,
          value: variableValue,
          initialized: isInitialized,
        };
      }
    }
  }

  analyzeExpression(node) {
    switch (node.type) {
      case "BinaryOperation":
        const leftType = this.evaluateExpressionType(node.left);
        const rightType = this.evaluateExpressionType(node.right);
        if (
          (["+", "-", "*", "/", "<", ">", "<=", ">=", "==", "<>"].includes(
            node.operator
          ) &&
            ["INT", "FLOAT"].includes(leftType) &&
            ["INT", "FLOAT"].includes(rightType)) ||
          (["AND", "OR", "==", "<>"].includes(node.operator) &&
            leftType === "BOOL" &&
            rightType === "BOOL")
        ) {
          this.analyzeExpression(node.left);
          this.analyzeExpression(node.right);
        } else {
          this.errors.push(
            `Invalid operand for arithmetic operation '${node.operator}' for types: ${leftType} and ${rightType}`
          );
        }
        break;
      case "UnaryOperation":
        this.analyzeExpression(node.operand);
        break;
      case "IDENTIFIER":
        if (!this.symbolTable[node.name]) {
          this.errors.push(
            `Undeclared variable '${node.name}' used in expression.`
          );
        } else if (!this.symbolTable[node.name].initialized) {
          this.errors.push(
            `Uninitialized variable '${node.name}' used in expression.`
          );
        }
        break;
    }
  }

  //para di mo erroran ang mga variables sa scan statement
  analyzeScanStatement(scanNode) {
    scanNode.variableNames.forEach((variableName) => {
      if (this.symbolTable[variableName]) {
        this.symbolTable[variableName].initialized = true;
      } else {
        this.errors.push(`Variable '${variableName}' not declared.`);
      }
    });
  }

  analyzeDisplayStatement(displayNode) {
    const parts = displayNode.parts;
    const concatableTypes = [
      "IDENTIFIER",
      "STRING",
      "ESCAPE",
      "NEWLINE",
      "BinaryOperation",
      "Literal",
    ];
    let prevType = null;
    parts.forEach((part) => {
      if (concatableTypes.includes(part.type)) {
        if (part.type === "ESCAPE") {
          if (!this.reservedSymbols.includes(part.value)) {
            this.errors.push(`Invalid escape sequence: ${part.value}`);
          }
        }

        if (concatableTypes.includes(prevType)) {
          this.errors.push(
            "Missing concatenation operator '&' between display parts."
          );
        }
        if (part.type === "IDENTIFIER") {
          if (!this.symbolTable[part.name]) {
            this.errors.push(
              `Undeclared variable '${part.name}' used in display statement.`
            );
          }
        }
        prevType = part.type;
      } else if (part.type === "CONCAT") {
        if (prevType === null) {
          this.errors.push(
            "Leading concatenation operator '&' in display statement."
          );
        } else if (prevType === "CONCAT") {
          this.errors.push(
            "Consecutive concatenation operators '&' in display statement."
          );
        }

        prevType = "CONCAT";
      }

      if (part.type === "IdentifierNode") {
        if (!this.symbolTable[part.name]) {
          this.errors.push(
            `Undeclared variable '${part.name}' used in display statement.`
          );
        }
      } else if (
        part instanceof BinaryOperationNode ||
        part.type === "BinaryOperation"
      ) {
        this.analyzeExpression(part);
      }
    });

    if (prevType === "CONCAT") {
      this.errors.push(
        "Trailing concatenation operator '&' in display statement."
      );
    }
  }

  analyzeReassignmentStatement(node) {
    const variableName = node.name;
    let variableValue = node.value;

    if (node.type === "ReassignmentStatement") {
      if (variableValue.type === "ReassignmentStatement") {
        variableValue = this.analyzeReassignmentStatement(variableValue);
      }
      return variableValue;
    }

    if (!this.symbolTable[variableName]) {
      this.errors.push(`Variable '${variableName}' not declared.`);
      return;
    }

    const expressionType = this.evaluateExpressionType(variableValue);
    const declaredType = this.symbolTable[variableName].type;

    if (!this.checkTypeCompatibility(declaredType, variableValue)) {
      this.errors.push(
        `Type mismatch in assignment to '${variableName}': cannot assign ${expressionType} to ${declaredType}.`
      );
    } else {
      this.symbolTable[variableName].value = variableValue;
      this.symbolTable[variableName].initialized = true;
    }

    if (variableValue.type !== "ReassignmentStatement") {
      this.symbolTable[variableName] = {
        type: expressionType,
        value: variableValue,
        initialized: true,
      };

      return variableValue;
    }

    if (expressionType !== this.symbolTable[variableName].type) {
      this.errors.push(
        `Type mismatch in assignment to '${variableName}': cannot assign ${expressionType} to ${this.symbolTable[variableName].type}.`
      );
    } else {
      this.symbolTable[variableName].initialized = true;
    }
  }

  analyzeAssignmentStatement(node) {
    const variableName = node.variableName;
    let expression = node.expression;

    if (node.type === "AssignmentStatement") {
      if (expression.type === "AssignmentStatement") {
        expression = this.analyzeAssignmentStatement(expression);
      }
    }

    const expressionType = this.evaluateExpressionType(expression);
    if (
      !this.symbolTable[variableName] &&
      expression.type !== "AssignmentStatement"
    ) {
      this.symbolTable[variableName] = {
        type: expressionType,
        value: expression,
        initialized: true,
      };

      this.ast.declarations.push(
        new VariableDeclarationNode(expressionType, variableName, expression)
      );

      return expression;
    }

    if (expressionType !== this.symbolTable[variableName].type) {
      this.errors.push(
        `Type mismatch in assignment to '${variableName}': cannot assign ${expressionType} to ${this.symbolTable[variableName].type}.`
      );
    } else {
      this.symbolTable[variableName].initialized = true;
    }
  }

  checkTypeCompatibility(expectedType, value) {
    switch (expectedType) {
      case "INT":
        if (["BinaryOperation", "UnaryOperation"].includes(value.type)) {
          if (["+", "-", "*", "/"].includes(value.operator)) {
            return true;
          }
          return false;
        }
        return (
          Number.isInteger(value) ||
          ["Literal", "BinaryOperation", "UnaryOperation"].includes(value.type)
        );
      case "FLOAT":
        return typeof value === "number";
      case "STRING":
        return typeof value === "string";
      case "CHAR":
        return typeof value === "string" && value.length === 1;
      case "BOOL":
        if (["BinaryOperation", "UnaryOperation"].includes(value.type)) {
          if (!["+", "-", "*", "/"].includes(value.operator)) {
            return true;
          }
          return false;
        }
        return (
          typeof value === "boolean" ||
          ["BinaryOperation", "UnaryOperation"].includes(value.type)
        );
      // Add guro para sa array puhon
      default:
        return false;
    }
  }

  evaluateExpressionType(expression) {
    if (typeof expression === "boolean") {
      return "BOOL";
    }
    switch (expression.type) {
      case "BinaryOperation": {
        const leftType = this.evaluateExpressionType(expression.left);
        const rightType = this.evaluateExpressionType(expression.right);
        if (leftType === "BOOL" && rightType === "BOOL") {
          return "BOOL";
        } else if (
          (leftType === "BOOL" && rightType === "INT") ||
          (leftType === "INT" && rightType === "BOOL")
        ) {
          return "BOOL";
        }
        if (leftType === "INT" && rightType === "INT") {
          return "INT";
        } else if (
          (leftType === "FLOAT" && rightType === "INT") ||
          (leftType === "INT" && rightType === "FLOAT") ||
          (leftType === "FLOAT" && rightType === "FLOAT")
        ) {
          return "FLOAT";
        } else if (leftType === "STRING" || rightType === "STRING") {
          return "STRING";
        } else {
          throw new Error(
            `Unsupported type combination in binary operation: ${leftType} and ${rightType}`
          );
        }
      }
      case "UnaryOperation": {
        return this.evaluateExpressionType(expression.operand);
      }
      case "IDENTIFIER": {
        const variableInfo = this.symbolTable[expression.name];
        if (!variableInfo) {
          throw new Error(`Undefined variable '${expression.name}'`);
        }
        return variableInfo.type;
      }
      case "Literal": {
        if (typeof expression.value === "number") {
          return Number.isInteger(expression.value) ? "INT" : "FLOAT";
        } else if (typeof expression.value === "string") {
          return "STRING";
        } else {
          throw new Error(
            `Unsupported literal type: ${typeof expression.value}`
          );
        }
      }
      default:
        throw new Error(`Unsupported expression type: ${expression.type}`);
    }
  }

  report() {
    // print errors if naa
    if (this.errors.length > 0) {
      console.error("Semantic errors found:");
      this.errors.forEach((error) => console.error(error));
    } else {
      console.log("Semantic analysis successful. No errors found.");
    }
  }
}

module.exports = { SemanticAnalyzer };

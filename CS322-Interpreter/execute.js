const readline = require("readline");
const {
  ProgramNode,
  VariableDeclarationNode,
  DisplayStatementNode,
  ScanStatementNode,
  AssignmentStatementNode,
  BinaryOperationNode,
  UnaryOperationNode,
  IdentifierNode,
  LiteralNode,
} = require("./parser");

function execute(ast, callback) {
  const symbolTable = {};

  ast.declarations.forEach((declaration) => {
    if (declaration.value !== undefined) {
      //added type and value to symbol table
      //console.log("Declaration:", declaration); // Debug log
      if (
        declaration.value &&
        ["Literal", "BinaryOperation", "UnaryOperation"].includes(
          declaration.value.type
        )
      ) {
        symbolTable[declaration.name] = {
          type: declaration.type,
          value: evaluateExpression(declaration.value, symbolTable),
        };
      } else {
        symbolTable[declaration.name] = {
          type: declaration.type,
          value: declaration.value,
        };
      }
    } else {
      switch (declaration.type) {
        case "INT":
          symbolTable[declaration.name] = { type: "INT", value: 0 };
          break;
        case "FLOAT":
          symbolTable[declaration.name] = { type: "FLOAT", value: 0.0 };
          break;
        case "CHAR":
          symbolTable[declaration.name] = { type: "CHAR", value: "" };
          break;
        case "STRING":
          symbolTable[declaration.name] = { type: "STRING", value: "" };
          break;
        case "BOOL":
          symbolTable[declaration.name] = { type: "BOOL", value: false };
          break;
        default:
          symbolTable[declaration.name] = undefined;
      }
    }
  });

  const statementQueue = [...ast.statements];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const runStatement = async (statement) => {
    if (statement.type === "DisplayStatement") {
      let output = "";
      statement.parts.forEach((part) => {
        if (part.type === "CONCAT") return;
        if (part.type === "IDENTIFIER") {
          if (symbolTable[part.name] !== undefined) {
            while (
              symbolTable[part.name].value &&
              symbolTable[part.name].value.type === "IDENTIFIER"
            ) {
              part = symbolTable[part.name].value;
            }
            output +=
              symbolTable[part.name].type === "BOOL"
                ? symbolTable[part.name].value
                  ? "TRUE"
                  : "FALSE"
                : symbolTable[part.name].value;
          } else {
            output += part.value.toString();
          }
        } else if (part instanceof BinaryOperationNode) {
          const result = evaluateExpression(part, symbolTable);
          output +=
            typeof result === "boolean"
              ? result
                ? "TRUE"
                : "FALSE"
              : result.toString();
        } else if (part instanceof UnaryOperationNode) {
          const result = evaluateExpression(part, symbolTable);
          output +=
            typeof result === "boolean"
              ? result
                ? "TRUE"
                : "FALSE"
              : result.toString();
        } else if (
          part.type === "STRING" ||
          part.type === "ESCAPE" ||
          part.type === "SYMBOL" ||
          part.type === "Literal"
        ) {
          output += part.value;
        } else if (part.type === "NEWLINE") {
          output += "\n";
        } else {
          throw new Error("Unsupported part type: " + part.type);
        }
      });
      console.log(output);
      nextStatement();
    } else if (statement.type === "ReassignmentStatement") {
      let currStatement = statement;
      const passedReassignmentVariables = [];
      while (
        currStatement.value &&
        currStatement.value.type === "ReassignmentStatement"
      ) {
        currStatement = currStatement.value;
        passedReassignmentVariables.push(currStatement.name);
      }

      passedReassignmentVariables.forEach((variable) => {
        symbolTable[variable].value = evaluateExpression(
          currStatement.value,
          symbolTable
        );
      });
      symbolTable[statement.name].value = evaluateExpression(
        currStatement.value,
        symbolTable
      );
      nextStatement();
    } else if (statement.type === "AssignmentStatement") {
      symbolTable[statement.variableName] = evaluateExpression(
        statement.expression,
        symbolTable
      );
      nextStatement();
    } else if (statement.type === "ScanStatement") {
      await new Promise((resolve) => {
        rl.question(
          "SCAN " + statement.variableNames.join(", ") + ":",
          (input) => {
            const inputs = input.split(",").map((val) => val.trim());
            statement.variableNames.forEach((name, index) => {
              const type = symbolTable[name]?.type;
              if (type === "INT") {
                symbolTable[name].value = parseInt(inputs[index], 10);
                if (isNaN(symbolTable[name].value)) {
                  throw new Error("Invalid input for INT type");
                }
              } else if (type === "FLOAT") {
                symbolTable[name].value = parseFloat(inputs[index]);
              } else if (type === "BOOL") {
                if (!["TRUE", "FALSE"].includes(inputs[index])) {
                  throw new Error("Invalid input for BOOL type");
                }
                symbolTable[name].value =
                  inputs[index] === "TRUE" ? true : false;
              } else if (type === "CHAR") {
                if (inputs[index].length !== 1) {
                  throw new Error("Invalid input for CHAR type");
                }
                symbolTable[name].value = inputs[index];
              }
            });
            resolve();
          }
        );
      });

      nextStatement();
    } else if (statement.type === "ConditionalStatement") {
      const condition = evaluateExpression(statement.condition, symbolTable);
      if (condition) {
        statement.ifBlock.map((s) => {
          runStatement(s);
        });
      } else {
        // check elseifblocks first
        let executed = false;
        statement.elseIfBlocks.forEach((elseIfBlock) => {
          if (evaluateExpression(elseIfBlock.condition, symbolTable)) {
            executed = true;
            elseIfBlock.statements.map((s) => {
              runStatement(s);
            });
            return;
          }
        });

        if (!executed && statement.elseBlock) {
          statement.elseBlock.map((s) => {
            runStatement(s);
          });
        }
      }
      nextStatement();
    }
  };

  async function nextStatement() {
    if (statementQueue.length === 0) {
      rl.close();
      if (typeof callback === "function") {
        callback();
      }
      return;
    }

    const statement = statementQueue.shift();
    await runStatement(statement);
  }

  nextStatement();

  function evaluateExpression(node, symbolTable) {
    if (node.type === "BinaryOperation") {
      const left = evaluateExpression(node.left, symbolTable);
      const right = evaluateExpression(node.right, symbolTable);
      switch (node.operator) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          if (right === 0) {
            throw new Error("Division by zero error");
          }
          return left / right;
        case "%":
          return left % right;
        case "^":
          return Math.pow(left, right);
        case "==":
          return left === right;
        case "!=":
          return left !== right;
        case ">":
          return left > right;
        case "<":
          return left < right;
        case ">=":
          return left >= right;
        case "<=":
          return left <= right;
        case "<>":
          return left !== right;
        case "&&":
          return left && right;
        case "||":
          return left || right;
        case "AND":
          return left && right;
        case "OR":
          return left || right;

        default:
          throw new Error("Unsupported operator: " + node.operator);
      }
    } else if (node.type === "IDENTIFIER") {
      const variable = symbolTable[node.name];
      if (!variable) {
        throw new Error(`Variable ${node.name} not found`);
      }

      if (variable.value.type === "BinaryOperation") {
        return evaluateExpression(variable.value, symbolTable);
      }

      return variable.value;
    } else if (node.type === "Literal") {
      return node.value;
    } else if (node.type === "UnaryOperation") {
      const operand = evaluateExpression(node.operand, symbolTable);
      switch (node.operator) {
        case "+":
          return +operand;
        case "-":
          return -operand;
        case "NOT":
          return !operand;
        default:
          throw new Error("Unsupported operator: " + node.operator);
      }
    } else if (typeof node === "boolean") {
      return node;
    } else {
      console.log(node); // Debug log
      throw new Error("Unsupported node type: " + node.type);
    }
  }
}

module.exports = { execute };

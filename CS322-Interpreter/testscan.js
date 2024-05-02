
const { execute } = require('./execute');
  
  const testScanFunctionality = () => {

    const ast = {
      type: 'Program',
      declarations: [
        { type: 'INT', name: 'x' },
        { type: 'INT', name: 'y' }
      ],
      statements: [
        { type: 'ScanStatement', variableNames: ['x', 'y'] },
        { type: 'DisplayStatement', parts: [{type: 'IDENTIFIER', value: 'x'}, {type: 'CONCAT'}, {type: 'IDENTIFIER', value: 'y'}] }
      ]
    };
  
    execute(ast, (output) => {
        console.log(output); 
        
      });
      
      
  };
  
  testScanFunctionality();
  
const noRegularCreateElementRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ban React createElement in regular application code; use JSX instead',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source?.value !== 'react') {
          return;
        }

        node.specifiers.forEach((specifier) => {
          if (specifier.type !== 'ImportSpecifier') {
            return;
          }

          if (specifier.imported.type !== 'Identifier' || specifier.imported.name !== 'createElement') {
            return;
          }

          context.report({
            node: specifier,
            message: 'Use JSX instead of importing createElement from react in regular application code.',
          });
        });
      },
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression'
          || node.callee.computed
          || node.callee.object.type !== 'Identifier'
          || node.callee.object.name !== 'React'
          || node.callee.property.type !== 'Identifier'
          || node.callee.property.name !== 'createElement'
        ) {
          return;
        }

        context.report({
          node,
          message: 'Use JSX instead of React.createElement in regular application code.',
        });
      },
    };
  },
};

const requireComponentRootTestIdRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require exported React component roots to use ComponentName and child test ids to use ComponentName--thing',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        const componentDefinitions = readComponentDefinitions(program);

        componentDefinitions.forEach((componentDefinition) => {
          const rootBranches = readRootBranchesForComponent(componentDefinition);
          const rootNodes = new Set();

          rootBranches.forEach((rootBranch) => {
            rootBranch.testIdEntries.forEach((testIdEntry) => {
              rootNodes.add(testIdEntry.node);
            });

            if (componentDefinition.isExported) {
              reportInvalidExportedRoot(context, componentDefinition.name, rootBranch);
            } else {
              reportInvalidLocalRoot(context, componentDefinition.name, rootBranch);
            }
          });

          const componentTestIdEntries = readComponentTestIdEntries(componentDefinition);
          componentTestIdEntries.forEach((testIdEntry) => {
            if (rootNodes.has(testIdEntry.node)) {
              return;
            }

            testIdEntry.candidates.forEach((candidate) => {
              if (isValidChildTestId(candidate, componentDefinition.name)) {
                return;
              }

              context.report({
                node: testIdEntry.node,
                message:
                  `Component "${componentDefinition.name}" must use child test ids in the format "${componentDefinition.name}--thing". Received "${candidate}".`,
              });
            });
          });
        });
      },
    };
  },
};

const plugin = {
  meta: {
    name: 'repo-react',
  },
  rules: {
    'no-regular-create-element': noRegularCreateElementRule,
    'require-component-root-testid': requireComponentRootTestIdRule,
  },
};

export default plugin;

function readComponentDefinitions(program) {
  return program.body.flatMap((statement) => readStatementComponentDefinitions(statement, false));
}

function readStatementComponentDefinitions(statement, isExported) {
  if (statement.type === 'ExportNamedDeclaration') {
    return statement.declaration ? readDeclarationComponentDefinitions(statement.declaration, true) : [];
  }

  if (statement.type === 'ExportDefaultDeclaration') {
    return readDefaultComponentDefinitions(statement.declaration, true);
  }

  return readDeclarationComponentDefinitions(statement, isExported);
}

function readDeclarationComponentDefinitions(declaration, isExported) {
  if (declaration.type === 'FunctionDeclaration') {
    if (!declaration.id || !isPascalCase(declaration.id.name)) {
      return [];
    }

    return [{ name: declaration.id.name, kind: 'function', node: declaration, isExported }];
  }

  if (declaration.type === 'ClassDeclaration') {
    if (!declaration.id || !isPascalCase(declaration.id.name)) {
      return [];
    }

    return [{ name: declaration.id.name, kind: 'class', node: declaration, isExported }];
  }

  if (declaration.type !== 'VariableDeclaration') {
    return [];
  }

  return declaration.declarations.flatMap((declarator) => {
    if (declarator.id.type !== 'Identifier' || !isPascalCase(declarator.id.name)) {
      return [];
    }

    const componentNode = readWrappedFunctionLike(declarator.init);
    if (!componentNode) {
      return [];
    }

    return [{ name: declarator.id.name, kind: 'function', node: componentNode, isExported }];
  });
}

function readDefaultComponentDefinitions(declaration, isExported) {
  if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
    if (!declaration.id || !isPascalCase(declaration.id.name)) {
      return [];
    }

    return declaration.type === 'FunctionDeclaration'
      ? [{ name: declaration.id.name, kind: 'function', node: declaration, isExported }]
      : [{ name: declaration.id.name, kind: 'class', node: declaration, isExported }];
  }

  const componentNode = readWrappedFunctionLike(declaration);
  if (!componentNode || !componentNode.id || !isPascalCase(componentNode.id.name)) {
    return [];
  }

  return [{ name: componentNode.id.name, kind: 'function', node: componentNode, isExported }];
}

function readWrappedFunctionLike(initializer) {
  if (!initializer) {
    return null;
  }

  if (initializer.type === 'ArrowFunctionExpression' || initializer.type === 'FunctionExpression') {
    return initializer;
  }

  if (initializer.type !== 'CallExpression') {
    return null;
  }

  const wrappedInitializer = initializer.arguments[0];
  if (!wrappedInitializer || wrappedInitializer.type === 'SpreadElement') {
    return null;
  }

  return readWrappedFunctionLike(wrappedInitializer);
}

function readRootBranchesForComponent(componentDefinition) {
  const returnExpressions = componentDefinition.kind === 'class'
    ? readClassRenderReturnExpressions(componentDefinition.node)
    : readFunctionReturnExpressions(componentDefinition.node);

  return returnExpressions.flatMap((returnExpression) => readRootBranches(returnExpression));
}

function readClassRenderReturnExpressions(classDeclaration) {
  const renderMethod = classDeclaration.body.body.find((member) => {
    return member.type === 'MethodDefinition'
      && !member.computed
      && member.key.type === 'Identifier'
      && member.key.name === 'render';
  });

  if (!renderMethod || !renderMethod.value.body) {
    return [];
  }

  return readReturnExpressionsFromBlock(renderMethod.value.body, renderMethod.value);
}

function readFunctionReturnExpressions(functionNode) {
  if (!functionNode.body) {
    return [];
  }

  if (functionNode.body.type !== 'BlockStatement') {
    return [functionNode.body];
  }

  return readReturnExpressionsFromBlock(functionNode.body, functionNode);
}

function readReturnExpressionsFromBlock(blockNode, rootFunctionNode) {
  const returnExpressions = [];

  visitNode(blockNode);
  return returnExpressions;

  function visitNode(node) {
    if (!isAstNode(node)) {
      return;
    }

    if (node !== rootFunctionNode && isNestedFunctionNode(node)) {
      return;
    }

    if (node !== rootFunctionNode && isNestedClassNode(node)) {
      return;
    }

    if (node.type === 'ReturnStatement') {
      if (node.argument) {
        returnExpressions.push(node.argument);
      }
      return;
    }

    readChildNodes(node).forEach(visitNode);
  }
}

function readRootBranches(expression) {
  const unwrappedExpression = unwrapExpression(expression);

  if (unwrappedExpression.type === 'ConditionalExpression') {
    return [
      ...readRootBranches(unwrappedExpression.consequent),
      ...readRootBranches(unwrappedExpression.alternate),
    ];
  }

  if (unwrappedExpression.type === 'LogicalExpression' && unwrappedExpression.operator === '&&') {
    return readRootBranches(unwrappedExpression.right);
  }

  if (isNullLiteral(unwrappedExpression)) {
    return [{ kind: 'null', node: unwrappedExpression, testIdEntries: [] }];
  }

  if (unwrappedExpression.type === 'JSXFragment') {
    return [{ kind: 'fragment', node: unwrappedExpression, testIdEntries: [] }];
  }

  if (unwrappedExpression.type === 'JSXElement') {
    return [{
      kind: 'jsx',
      node: unwrappedExpression,
      testIdEntries: readJsxAttributeTestIdEntries(unwrappedExpression.openingElement.attributes),
    }];
  }

  if (unwrappedExpression.type === 'JSXSelfClosingElement') {
    return [{
      kind: 'jsx',
      node: unwrappedExpression,
      testIdEntries: readJsxAttributeTestIdEntries(unwrappedExpression.attributes),
    }];
  }

  return [{ kind: 'other', node: unwrappedExpression, testIdEntries: [], summary: summarizeNode(unwrappedExpression) }];
}

function readComponentTestIdEntries(componentDefinition) {
  const componentBody = componentDefinition.kind === 'class'
    ? readClassRenderBody(componentDefinition.node)
    : componentDefinition.node.body;

  if (!componentBody) {
    return [];
  }

  return readTestIdEntriesFromNode(componentBody, componentBody);
}

function readClassRenderBody(classDeclaration) {
  const renderMethod = classDeclaration.body.body.find((member) => {
    return member.type === 'MethodDefinition'
      && !member.computed
      && member.key.type === 'Identifier'
      && member.key.name === 'render';
  });

  return renderMethod?.value.body ?? null;
}

function readTestIdEntriesFromNode(rootNode, boundaryNode) {
  const testIdEntries = [];

  visitNode(rootNode);
  return testIdEntries;

  function visitNode(node) {
    if (!isAstNode(node)) {
      return;
    }

    if (node !== boundaryNode && isNestedFunctionNode(node)) {
      return;
    }

    if (node !== boundaryNode && isNestedClassNode(node)) {
      return;
    }

    if (node.type === 'JSXElement') {
      testIdEntries.push(...readJsxAttributeTestIdEntries(node.openingElement.attributes));
      node.children.forEach(visitNode);
      return;
    }

    if (node.type === 'JSXSelfClosingElement') {
      testIdEntries.push(...readJsxAttributeTestIdEntries(node.attributes));
      return;
    }

    readChildNodes(node).forEach(visitNode);
  }
}

function readJsxAttributeTestIdEntries(attributesNode) {
  return attributesNode.filter((attribute) => {
    return attribute.type === 'JSXAttribute' && isTestIdAttributeName(readJsxAttributeName(attribute.name));
  }).map((attribute) => ({
    node: attribute,
    candidates: readTestIdCandidatesFromJsxAttribute(attribute),
  }));
}

function readTestIdCandidatesFromJsxAttribute(attribute) {
  const initializer = attribute.value;
  if (!initializer) {
    return [];
  }

  if (initializer.type === 'Literal' && typeof initializer.value === 'string') {
    return [initializer.value];
  }

  if (
    initializer.type !== 'JSXExpressionContainer' || !initializer.expression
    || initializer.expression.type === 'JSXEmptyExpression'
  ) {
    return [];
  }

  return readExpressionStringCandidates(initializer.expression);
}

function readExpressionStringCandidates(expression) {
  const unwrappedExpression = unwrapExpression(expression);

  if (unwrappedExpression.type === 'Literal') {
    return typeof unwrappedExpression.value === 'string' ? [unwrappedExpression.value] : [];
  }

  if (unwrappedExpression.type === 'TemplateLiteral') {
    if (unwrappedExpression.expressions.length !== 0 || unwrappedExpression.quasis.length !== 1) {
      return [];
    }

    const cookedValue = unwrappedExpression.quasis[0]?.value.cooked;
    return typeof cookedValue === 'string' ? [cookedValue] : [];
  }

  if (unwrappedExpression.type === 'ConditionalExpression') {
    return [
      ...readExpressionStringCandidates(unwrappedExpression.consequent),
      ...readExpressionStringCandidates(unwrappedExpression.alternate),
    ];
  }

  return [];
}

function reportInvalidExportedRoot(context, componentName, rootBranch) {
  if (rootBranch.kind === 'null') {
    return;
  }

  if (rootBranch.kind === 'fragment') {
    context.report({
      node: rootBranch.node,
      message: `Exported component "${componentName}" returns a fragment root; wrap it in a DOM element with data-testid="${componentName}".`,
    });
    return;
  }

  if (rootBranch.kind === 'other') {
    context.report({
      node: rootBranch.node,
      message: `Exported component "${componentName}" returns ${rootBranch.summary}; render a root data-testid="${componentName}" instead.`,
    });
    return;
  }

  const hasExactRootTestId = rootBranch.testIdEntries.some((testIdEntry) => {
    return testIdEntry.candidates.some((candidate) => candidate === componentName);
  });

  if (hasExactRootTestId) {
    return;
  }

  context.report({
    node: rootBranch.testIdEntries[0]?.node ?? rootBranch.node,
    message: `Exported component "${componentName}" must render a root data-testid or testId exactly equal to "${componentName}".`,
  });
}

function reportInvalidLocalRoot(context, componentName, rootBranch) {
  if (rootBranch.kind === 'null' || rootBranch.testIdEntries.length === 0) {
    return;
  }

  rootBranch.testIdEntries.forEach((testIdEntry) => {
    testIdEntry.candidates.forEach((candidate) => {
      if (candidate === componentName) {
        return;
      }

      context.report({
        node: testIdEntry.node,
        message: `Component "${componentName}" must use the plain root test id "${componentName}" on its root element. Received "${candidate}".`,
      });
    });
  });
}

function isValidChildTestId(value, componentName) {
  return new RegExp(`^${componentName}--[a-z0-9]+(?:-[a-z0-9]+)*$`, 'u').test(value);
}

function unwrapExpression(expression) {
  let currentExpression = expression;

  while (currentExpression.type === 'ParenthesizedExpression') {
    currentExpression = currentExpression.expression;
  }

  return currentExpression;
}

function isTestIdAttributeName(attributeName) {
  return attributeName === 'data-testid' || attributeName === 'testId';
}

function readJsxAttributeName(attributeName) {
  if (attributeName.type === 'JSXIdentifier') {
    return attributeName.name;
  }

  if (attributeName.type === 'JSXNamespacedName') {
    return `${attributeName.namespace.name}:${attributeName.name.name}`;
  }

  return '';
}

function summarizeNode(node) {
  const rawName = node.type.replace(/Expression$/u, ' expression');
  return rawName.toLowerCase();
}

function readChildNodes(node) {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === 'parent' || key === 'loc' || key === 'range') {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter(isAstNode);
    }

    return isAstNode(value) ? [value] : [];
  });
}

function isNestedFunctionNode(node) {
  return node.type === 'FunctionDeclaration'
    || node.type === 'FunctionExpression'
    || node.type === 'ArrowFunctionExpression';
}

function isNestedClassNode(node) {
  return node.type === 'ClassDeclaration' || node.type === 'ClassExpression';
}

function isAstNode(value) {
  return value !== null && typeof value === 'object' && typeof value.type === 'string';
}

function isNullLiteral(node) {
  return node.type === 'Literal' && node.value === null;
}

function isPascalCase(value) {
  return /^[A-Z][A-Za-z0-9]*$/u.test(value);
}

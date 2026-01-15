module.exports = function () {
  return {
    visitor: {
      CallExpression(path) {
        // Check if this is import.meta.glob(...)
        if (
          path.node.callee &&
          path.node.callee.type === 'MemberExpression' &&
          path.node.callee.object &&
          path.node.callee.object.type === 'MetaProperty' &&
          path.node.callee.object.meta &&
          path.node.callee.object.meta.name === 'import' &&
          path.node.callee.object.property &&
          path.node.callee.object.property.name === 'meta' &&
          path.node.callee.property &&
          path.node.callee.property.name === 'glob'
        ) {
          // Replace import.meta.glob(...) with a function that returns an empty object
          // This allows convex-test to work when modules are provided manually
          path.replaceWithSourceString('(() => ({}))');
        }
      },
    },
  };
};

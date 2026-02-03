
module.exports = {
env: {
browser: true,
es2022: true,
node: true,
jest: true
},
parserOptions: {
ecmaVersion: 2022,
sourceType: "module"
},
rules: {
"no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
"no-console": "off"
}
};

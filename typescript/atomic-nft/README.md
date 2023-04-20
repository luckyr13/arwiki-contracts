## Installation

`npm install`

## Transpilation

`npm run build`

## Notes

When you build the project a new folder will be created called `dist` with the transpiled smartweave contract with the name `bundle.js`. By default, `rollup` adds the next line to the end of the bundle:

`export { handle };`

You need to remove this line manually before deploying the contract!
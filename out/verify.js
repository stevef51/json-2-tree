"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const json_tree_1 = require("./json-tree");
class SimpleFlattenTest {
    constructor(doNotStoreThis) {
        this.doNotStoreThis = doNotStoreThis;
    }
    setUnderlyingData(data) {
        this._underlyingData = data;
    }
    getUnderlyingData() {
        return this._underlyingData;
    }
    static registerJsonTree() {
        json_tree_1.JsonTree.registerType({
            ctr: SimpleFlattenTest,
            flatten(o) {
                return o._underlyingData;
            },
            fatten(o) {
                let result = new SimpleFlattenTest(undefined);
                result.setUnderlyingData(o);
                return result;
            }
        });
    }
}
SimpleFlattenTest.registerJsonTree();
let test = new SimpleFlattenTest('do not store this');
test.setUnderlyingData('some important data');
let popsicle = json_tree_1.JsonTree.stringify(test);
let test2 = json_tree_1.JsonTree.parse(popsicle);
console.log(JSON.stringify(test));
console.log(JSON.stringify(test2));
//# sourceMappingURL=verify.js.map
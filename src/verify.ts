import { JsonTree } from "./json-tree";

class SimpleFlattenTest {
	private _underlyingData: any;

	constructor(public doNotStoreThis: any) {

	}

	setUnderlyingData(data: any) {
		this._underlyingData = data;
	}

	getUnderlyingData(): any {
		return this._underlyingData;
	}

	static registerJsonTree() {
		JsonTree.registerType({
			ctr: SimpleFlattenTest,
			flatten(o: SimpleFlattenTest) {
				return o._underlyingData;
			},
			fatten(o: any) {
				let result = new SimpleFlattenTest(undefined);
				result.setUnderlyingData(o);
				return result;
			}
		})
	}
}

SimpleFlattenTest.registerJsonTree();

let test = new SimpleFlattenTest('do not store this');
test.setUnderlyingData('some important data');

let popsicle = JsonTree.stringify(test);
let test2 = JsonTree.parse(popsicle);

console.log(JSON.stringify(test));
console.log(JSON.stringify(test2));

import test from "node:test";
import assert from "node:assert/strict";
import { classificationSchema, classificationRows } from "../scripts/editorial-schemas";

test("classification requires every article key and pins each row to its source ID",()=>{
  const schema=classificationSchema(["source-a","source-b"]);
  const props=schema.properties as Record<string,{required:string[];additionalProperties:boolean;properties:Record<string,{properties:{id:{enum:string[]}}}>}>;
  assert.deepEqual(props.articles.required,["source-a","source-b"]);
  assert.equal(props.articles.additionalProperties,false);
  assert.deepEqual(props.articles.properties["source-a"].properties.id.enum,["source-a"]);
  assert.deepEqual(classificationRows({articles:{"source-b":{id:"source-b",include:false},"source-a":{id:"source-a",include:true}}},schema),[{id:"source-a",include:true},{id:"source-b",include:false}]);
  for(const articles of [{},{"source-a":{id:"source-a"}},{"source-a":{id:"source-b"},"source-b":{id:"source-b"}},{"source-a":{id:"source-a"},"unknown":{id:"unknown"}},[]])assert.throws(()=>classificationRows({articles},schema));
  assert.throws(()=>classificationSchema([]));assert.throws(()=>classificationSchema(["a","a"]));
});

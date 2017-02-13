(function(){

console.log('$');

var $ = function(obj){
	if (obj instanceof $)return obj;
	if(!this instanceof $) return new $(obj);
	$._wrapped = obj;
}

window.$ = $;
$.a = function(){
	console.log(1);
}


window.b = 1;
var objA = {
	b:'here is in objA'
}
function a(x){
	console.log(this.b,x);
}

var aBound = _.bind(a,objA);
// aBound('123');

new aBound('123');

}());



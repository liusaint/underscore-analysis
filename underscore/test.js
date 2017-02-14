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
	this.a = 1;
	return {
		a:222
	}
}

var aBound = _.bind(a,objA);
// aBound('123');

console.log(new aBound('123'));

}());



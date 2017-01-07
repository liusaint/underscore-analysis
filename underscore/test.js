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

}());
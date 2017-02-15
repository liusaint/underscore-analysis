(function() {

	// console.log('$');

	// var $ = function(obj){
	// 	if (obj instanceof $)return obj;
	// 	if(!this instanceof $) return new $(obj);
	// 	$._wrapped = obj;
	// }

	// window.$ = $;
	// $.a = function(){
	// 	console.log(1);
	// }


	// window.b = 1;
	// var objA = {
	// 	b:'here is in objA'
	// }
	// function a(x){
	// 	console.log(this.b,x);
	// 	this.a = 1;
	// 	return {
	// 		a:222
	// 	}
	// }

	// var aBound = _.bind(a,objA);
	// aBound('123');

	// console.log(new aBound('123'));
	// 
	// 

	// var add = function(a, b,c,d,e) { return a+b+c+d+e; };
	//  add20 = _.partial(add, _, 2,_,4,_);
	// add20(1,3,5);
	// window.a = 'a in global';
	// var obj = {
	// 	a: 'a in obj',
	// 	b: 'b in obj',
	// 	c: 'c in obj',
	// 	fa: function() {
	// 		console.log(this.a);
	// 	},
	// 	fb: function() {
	// 		console.log(this.b);
	// 	},
	// 	fc: function() {
	// 		console.log(this.c);
	// 	}
	// }

	// var a = obj.fa;
	// a();//'a in global'。this指向全局对象
	// _.bindAll(obj, 'fa', 'fb', 'fc');
	// a =  obj.fa;
	// a();//a in obj。this指向绑定对象
	// 
	// 
	　

	// function add(n) {
	// 	console.log(n-1,n-2);
	// 	return n < 2 ? n : add(n - 1) + add(n - 2);
	// };
	// var goodAdd = _.memoize(function(n) {
	// 	console.log(n-1,n-2);
	// 	return n < 2 ? n : goodAdd(n - 1) + goodAdd(n - 2);
	// });
	// add(5)
	// goodAdd(5);

// var i = 0;
function log(){
	console.log(+new Date());
	return 1;
}
// log();

// var goodLog = _.throttle(log,1000,{leading:false});
// var goodLog = _.throttle(log,1000);
// var goodLog = _.throttle(log,1000,{trailing:false});

// console.log(+new Date());
// window.timer = setInterval(goodLog, 1);

// console.log(1)

// var goodLog1 = _.debounce(log,1000)
// window.timer = setInterval(goodLog1, 1);


var before = _.before(3,log);
console.log(before());
console.log(before());
console.log(before());
console.log(before());

}());
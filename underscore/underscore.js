//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

	// Baseline setup
	// --------------

	// Establish the root object, `window` (`self`) in the browser, `global`
	// on the server, or `this` in some virtual machines. We use `self`
	// instead of `window` for `WebWorker` support.
	// 建立root对象。
	// 浏览器中是window(或self)
	// 服务器是global
	// 其他设备则是　this
	var root = typeof self == 'object' && self.self === self && self ||
		typeof global == 'object' && global.global === global && global ||
		this;

	// Save the previous value of the `_` variable.
	// 保存之前的_变量的值。用于无冲突处理。
	// 因为我们要占用_这个全局变量。但是原来全局中可能已经有了这个变量。所以我们先把这个变量保存起来。
	// 当我们调用_.noConflict的时候，可以放弃本库对_的占用，使用其他的变量来代替。并且把_原来的值得还给全局。
	// 我要用_来代表我。但是会给_原来代表的内容留个位置放起来。
	var previousUnderscore = root._;

	// Save bytes in the minified (but not gzipped) version:
	// 保存常用的原型。
	var ArrayProto = Array.prototype,
		ObjProto = Object.prototype;
	var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

	// Create quick reference variables for speed access to core prototypes.
	// 创建快捷变量以更快地访问这些核心方法。另一个原因是压缩。
	var push = ArrayProto.push,
		slice = ArrayProto.slice,
		toString = ObjProto.toString,
		hasOwnProperty = ObjProto.hasOwnProperty;

	// All **ECMAScript 5** native function implementations that we hope to use
	// are declared here.
	// 这里定义我们会用到的es5原生的一些方法。
	var nativeIsArray = Array.isArray,
		nativeKeys = Object.keys,
		nativeCreate = Object.create;

	// Naked function reference for surrogate-prototype-swapping.
	// 空函数引用来代理原型
	var Ctor = function() {};

	// Create a safe reference to the Underscore object for use below.
	// 创建一个安全的underscore对象的引用以便后面使用。
	// 强制new。
	// 创建一个_库的实例。
	// 内部变量。_.chain()会调用它。
	var _ = function(obj) {
		//如果obj是_的实例，直接返回它
		if (obj instanceof _) return obj;
		//如果不是new _()这种方式调用的，强制new
		if (!(this instanceof _)) return new _(obj);
		//用于链式调用时，obj是链式调用时传入的参数。
		this._wrapped = obj;
	};


	// Export the Underscore object for **Node.js**, with
	// backwards-compatibility for their old module API. If we're in
	// the browser, add `_` as a global object.
	// (`nodeType` is checked to ensure that `module`
	// and `exports` are not HTML elements.)
	// 根据使用场景。决定_的暴露方式。
	if (typeof exports != 'undefined' && !exports.nodeType) {
		if (typeof module != 'undefined' && !module.nodeType && module.exports) {
			exports = module.exports = _;
		}
		exports._ = _;
	} else {
		root._ = _;
	}


	// Current version.
	// 版本号
	_.VERSION = '1.8.3';

	// cb处理的比optimizeCb处理的支持更多类型的参数。

	// Internal function that returns an efficient (for current engines) version
	// of the passed-in callback, to be repeatedly applied in other Underscore
	// functions.
	// 内部方法。返回一个传入的回调函数的高效率版本函数，以在其他Underscore函数中重复使用。
	// 这个函数是主要是对一些传入了obj的函数，回调需要绑定在这个obj上运行。

	//为遍历器绑定运行对象。将func中的this绑定到context对象上。以及在不同参数个数时的参数约定。
	//accumulator累加器
	//为什么不全部用apply而是前面几个用call呢。
	//一方面是因为call的运行效率高于apply.参考：http://blog.csdn.net/zhengyinhui100/article/details/7837127
	//另一方面也可以通过参数约定一下传入的几个值是什么。
	var optimizeCb = function(func, context, argCount) {
		if (context === void 0) return func;
		switch (argCount) {
			case 1:
				return function(value) {
					return func.call(context, value);
				};
				// The 2-parameter case has been omitted only because no current consumers
				// made use of it.
			case null:
			case 3:
				return function(value, index, collection) {
					return func.call(context, value, index, collection);
				};
			case 4:
				return function(accumulator, value, index, collection) {
					return func.call(context, accumulator, value, index, collection);
				};
		}
		return function() {
			return func.apply(context, arguments);
		};
	};


	var builtinIteratee;

	// An internal function to generate callbacks that can be applied to each
	// element in a collection, returning the desired result — either `identity`,
	// an arbitrary callback, a property matcher, or a property accessor.
	// 内部方法。
	// 这个方法的作用是给确保无论value传入的是什么类型的值，函数，对象，null等，都能把转换成一个函数以便进行迭代操作。

	var cb = function(value, context, argCount) {
		//检测iteratee是否被重定义了。如果是，就按自定义的方法来处理。
		if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
		//第一个参数null。
		if (value == null) return _.identity;
		//第一个参数为函数。返回绑定对象后的函数。
		if (_.isFunction(value)) return optimizeCb(value, context, argCount);
		//第一个参数是对象。返回一个函数检测是否含有其键值对。
		if (_.isObject(value) && !_.isArray(value)) return _.matcher(value);
		//返回一个函数，这个函数返回任何传入的对象的value属性的值。
		return _.property(value);
	};

	// External wrapper for our callback generator. Users may customize
	// `_.iteratee` if they want additional predicate/iteratee shorthand styles.
	// This abstraction hides the internal-only argCount argument.
	// 内部的函数生成器的包裹。
	// 用户可能会自定义_.iteratee。如果想要一些额外功能的迭代器或累加器的速记风格。
	// 这个抽象隐藏了参数数量这个参数。
	_.iteratee = builtinIteratee = function(value, context) {
		return cb(value, context, Infinity);
	};

	// Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
	// This accumulates the arguments passed into an array, after a given index.
	// 类似于es6中的rest参数。function fun(x,y,..z);  func(1,2,3,4,5)  x:1 y:2 z:[3,4,5]。即是把实参数量>=形参的部分放入一个数组中。
	// 这里加了个参数startIndex。表示从第几个参数开始放入rest数组。返回新函数。
	// 同理，这里的几个call的单独处理，也是对常见情况的高效率处理。因为call比apply运行速度快。
	var restArgs = function(func, startIndex) {
		startIndex = startIndex == null ? func.length - 1 : +startIndex;
		return function() {
			var length = Math.max(arguments.length - startIndex, 0),
				rest = Array(length),
				index = 0;
			for (; index < length; index++) {
				rest[index] = arguments[index + startIndex];
			}
			//几种常用的。使用call分装参数调用。
			switch (startIndex) {
				case 0:
					return func.call(this, rest);
				case 1:
					return func.call(this, arguments[0], rest);
				case 2:
					return func.call(this, arguments[0], arguments[1], rest);
			}
			//其他的，使用apply调用。
			var args = Array(startIndex + 1);
			for (index = 0; index < startIndex; index++) {
				args[index] = arguments[index];
			}
			args[startIndex] = rest;
			return func.apply(this, args);
		};
	};


	// An internal function for creating a new object that inherits from another.
	// 继承。
	// Ctor是一个内部定义的空函数。
	// 传入一个对象当做原型。
	var baseCreate = function(prototype) {
		if (!_.isObject(prototype)) return {};
		if (nativeCreate) return nativeCreate(prototype);
		Ctor.prototype = prototype;
		var result = new Ctor;
		//用完了清理现场
		Ctor.prototype = null;
		return result;
	};

	//生成一个获取某个特定对象的函数。比如length;
	var shallowProperty = function(key) {
		return function(obj) {
			return obj == null ? void 0 : obj[key];
		};
	};

	//获取某个路径的值。路径的意思{d:2,a:{b:{c:1}}} 路径：[a,b,c] 值：1.
	var deepGet = function(obj, path) {
		var length = path.length;
		for (var i = 0; i < length; i++) {
			if (obj == null) return void 0;
			obj = obj[path[i]];
		}
		return length ? obj : void 0;
	};

	// Helper for collection methods to determine whether a collection
	// should be iterated as an array or as an object.
	// Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
	// Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
	var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
	var getLength = shallowProperty('length');
	//判断是否arrayLike。类数组对象。console.log(isArrayLike([])),普通对象返回也是true。
	var isArrayLike = function(collection) {
		var length = getLength(collection);
		return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
	};


	// Collection Functions
	// --------------------

	// The cornerstone, an `each` implementation, aka `forEach`.
	// Handles raw objects in addition to array-likes. Treats all
	// sparse array-likes as if they were dense.
	// 基础。一个each实现。也叫　forEach;
	// 处理原始对象及array-like对象。
	// 稀疏数组也像密数组一样处理。
	_.each = _.forEach = function(obj, iteratee, context) {
		iteratee = optimizeCb(iteratee, context);
		var i, length;
		if (isArrayLike(obj)) {
			for (i = 0, length = obj.length; i < length; i++) {
				iteratee(obj[i], i, obj);
			}
		} else {
			var keys = _.keys(obj);
			for (i = 0, length = keys.length; i < length; i++) {
				iteratee(obj[keys[i]], keys[i], obj);
			}
		}
		return obj;
	};

	// Return the results of applying the iteratee to each element.
	// 遍历。收集结果返回。context表示运行环境。表示iteratee遍历器是运行在哪一个对象上的方法。
	_.map = _.collect = function(obj, iteratee, context) {
		iteratee = cb(iteratee, context);
		var keys = !isArrayLike(obj) && _.keys(obj),
			length = (keys || obj).length,
			results = Array(length);
		for (var index = 0; index < length; index++) {
			var currentKey = keys ? keys[index] : index;
			results[index] = iteratee(obj[currentKey], currentKey, obj);
		}
		return results;
	};

	// Create a reducing function iterating left or right.
	// 返回一个累加。从前往后或从后往前。
	// dir>0。正向。否则反向。dir为迭代间隔
	// memo为初始值。有初始值则从第一个开始遍历。否则从第二个开始遍历。
	// initial布尔值。是否有初始值。
	var createReduce = function(dir) {
		// Wrap code that reassigns argument variables in a separate function than
		// the one that accesses `arguments.length` to avoid a perf hit. (#1991)
		// 把这里分出来。一是可以先绑定好对象的遍历器，二是判断了一下是否有初始值
		var reducer = function(obj, iteratee, memo, initial) {
			var keys = !isArrayLike(obj) && _.keys(obj),
				length = (keys || obj).length,
				index = dir > 0 ? 0 : length - 1;
			//没有传递初始值。就把第一个值设为初始值，并且循环的index变化。
			if (!initial) {
				memo = obj[keys ? keys[index] : index];
				index += dir;
			}
			for (; index >= 0 && index < length; index += dir) {
				var currentKey = keys ? keys[index] : index;
				memo = iteratee(memo, obj[currentKey], currentKey, obj);
			}
			return memo;
		};


		return function(obj, iteratee, memo, context) {
			// 如果参数数量大于等于3，说明传递了初始值。
			var initial = arguments.length >= 3;
			//这传递过去的绑定好context的遍历器。
			return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
		};
	};

	// **Reduce** builds up a single result from a list of values, aka `inject`,
	// or `foldl`.
	// 正向
	_.reduce = _.foldl = _.inject = createReduce(1);

	// The right-associative version of reduce, also known as `foldr`.
	// 反向
	_.reduceRight = _.foldr = createReduce(-1);

	// Return the first value which passes a truth test. Aliased as `detect`.
	// 返回第一个满足条件的值。
	_.find = _.detect = function(obj, predicate, context) {
		var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
		var key = keyFinder(obj, predicate, context);
		if (key !== void 0 && key !== -1) return obj[key];
	};

	// Return all the elements that pass a truth test.
	// Aliased as `select`.
	// 返回所有满足条件的值。
	_.filter = _.select = function(obj, predicate, context) {
		var results = [];
		predicate = cb(predicate, context);
		_.each(obj, function(value, index, list) {
			if (predicate(value, index, list)) results.push(value);
		});
		return results;
	};

	// Return all the elements for which a truth test fails.
	// 返回所有不通过的项。
	_.reject = function(obj, predicate, context) {
		return _.filter(obj, _.negate(cb(predicate)), context);
	};

	// Determine whether all of the elements match a truth test.
	// Aliased as `all`.
	// 检测是否所有值都符合条件。
	_.every = _.all = function(obj, predicate, context) {
		predicate = cb(predicate, context);
		var keys = !isArrayLike(obj) && _.keys(obj),
			length = (keys || obj).length;
		for (var index = 0; index < length; index++) {
			var currentKey = keys ? keys[index] : index;
			if (!predicate(obj[currentKey], currentKey, obj)) return false;
		}
		return true;
	};

	// Determine if at least one element in the object matches a truth test.
	// Aliased as `any`.
	// 检测是否至少有一个满足
	_.some = _.any = function(obj, predicate, context) {
		predicate = cb(predicate, context);
		var keys = !isArrayLike(obj) && _.keys(obj),
			length = (keys || obj).length;
		for (var index = 0; index < length; index++) {
			var currentKey = keys ? keys[index] : index;
			if (predicate(obj[currentKey], currentKey, obj)) return true;
		}
		return false;
	};

	// Determine if the array or object contains a given item (using `===`).
	// Aliased as `includes` and `include`.
	// 判断一个array或object中是否包含某一项。使用　===　判断
	// 如果是数组，从第fromIndex开始
	_.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
		if (!isArrayLike(obj)) obj = _.values(obj);
		if (typeof fromIndex != 'number' || guard) fromIndex = 0;
		return _.indexOf(obj, item, fromIndex) >= 0;
	};

	// Invoke a method (with arguments) on every item in a collection.
	// 在list的每个元素上执行methodName方法。 任何传递给invoke的额外参数，invoke都会在调用methodName方法的时候传递给它。
	//{d:2,a:{b:{c:1}}} 路径：[a,b,c]
	// console.log(_.invoke([[5, 1, 7], [3, 2, 1]], 'sort'));
	// console.log(_.invoke([{d:2,a:{b:function(a){return a }}}, {d:2,a:{b:function(a){return a+a}}}], ['a','b'],1));
	// console.log(_.invoke([[5, 1, 7], [3, 2, 1]], function(){console.log(this[0])})); 

	_.invoke = restArgs(function(obj, path, args) {

		var contextPath, func;

		if (_.isFunction(path)) {
			func = path;
		} else if (_.isArray(path)) {
			//不要最后一位。slice(0, -1)
			contextPath = path.slice(0, -1);
			//取最后一位
			path = path[path.length - 1];
		}
		//把obj中的每一项当做回调中的context.
		return _.map(obj, function(context) {
			var method = func;
			if (!method) {
				if (contextPath && contextPath.length) {
					context = deepGet(context, contextPath);
				}
				if (context == null) return void 0;
				//比如到这里 context = [2,1,4].path传递的sort.
				//那么method就等于数组的sort方法 。
				method = context[path];
			}
			return method == null ? method : method.apply(context, args);
		});
	});


	// Convenience version of a common use case of `map`: fetching a property.
	// pluck也许是map最常使用的用例模型的简化版本，即萃取对象数组中某属性值，返回一个数组。
	_.pluck = function(obj, key) {
		return _.map(obj, _.property(key));
	};

	// Convenience version of a common use case of `filter`: selecting only objects
	// containing specific `key:value` pairs.
	// 遍历list中的每一个值，返回一个数组，这个数组包含包含properties所列出的属性的所有的键 - 值对。
	_.where = function(obj, attrs) {
		return _.filter(obj, _.matcher(attrs));
	};

	// Convenience version of a common use case of `find`: getting the first object
	// containing specific `key:value` pairs.
	// 返回第一组含有某键值对。
	_.findWhere = function(obj, attrs) {
		return _.find(obj, _.matcher(attrs));
	};

	// Return the maximum element (or element-based computation).
	// 返回list中的最大值。如果传递iteratee参数，iteratee将作为list中每个值的排序依据。
	// 如果list为空，将返回-Infinity，所以你可能需要事先用isEmpty检查 list 。
	_.max = function(obj, iteratee, context) {
		//默认给负无穷。然后一个一个对比 。
		var result = -Infinity,
			lastComputed = -Infinity,
			value, computed;
		//???第一个if的后半部分
		//console.log(_.max([1,2,3,4]));
		if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
			obj = isArrayLike(obj) ? obj : _.values(obj);
			for (var i = 0, length = obj.length; i < length; i++) {
				value = obj[i];
				if (value != null && value > result) {
					result = value;
				}
			}
		} else {
			iteratee = cb(iteratee, context);
			_.each(obj, function(v, index, list) {
				computed = iteratee(v, index, list);
				if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
					result = v;
					lastComputed = computed;
				}
			});
		}
		//返回的是排序的那个值。而不是计算的值。
		return result;
	};

	// Return the minimum element (or element-based computation).
	// 返回最小值。
	// 过程与上面一个function相当。
	_.min = function(obj, iteratee, context) {
		var result = Infinity,
			lastComputed = Infinity,
			value, computed;
		if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
			obj = isArrayLike(obj) ? obj : _.values(obj);
			for (var i = 0, length = obj.length; i < length; i++) {
				value = obj[i];
				if (value != null && value < result) {
					result = value;
				}
			}
		} else {
			iteratee = cb(iteratee, context);
			_.each(obj, function(v, index, list) {
				computed = iteratee(v, index, list);
				if (computed < lastComputed || computed === Infinity && result === Infinity) {
					result = v;
					lastComputed = computed;
				}
			});
		}
		return result;
	};

	// Shuffle a collection.
	// 打乱一个集合。
	_.shuffle = function(obj) {
		return _.sample(obj, Infinity);
	};

	// Sample **n** random values from a collection using the modern version of the
	// [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
	// If **n** is not specified, returns a single random element.
	// The internal `guard` argument allows it to work with `map`.
	// 返回数组中的一个或n个值。乱序
	_.sample = function(obj, n, guard) {
		//随机返回一个。
		if (n == null || guard) {
			if (!isArrayLike(obj)) obj = _.values(obj);
			return obj[_.random(obj.length - 1)];
		}
		var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
		var length = getLength(sample);
		n = Math.max(Math.min(n, length), 0);
		var last = length - 1;
		//???这个算法要多理解下。乱序先出来的与后面的交换位置。
		//相当于从后面的取出来一个放前面。再把操作序号往后推。
		for (var index = 0; index < n; index++) {
			var rand = _.random(index, last);
			var temp = sample[index];
			sample[index] = sample[rand];
			sample[rand] = temp;
		}
		return sample.slice(0, n);
	};



	// Sort the object's values by a criterion produced by an iteratee.
	// 返回一个排序后的list拷贝副本。
	// 如果传递iteratee参数，iteratee将作为list中每个值的排序依据。
	// 迭代器也可以是字符串的属性的名称进行排序的(比如 length)。
	_.sortBy = function(obj, iteratee, context) {
		var index = 0;
		iteratee = cb(iteratee, context);
		return _.pluck(_.map(obj, function(value, key, list) {
			//这里返回的值包含了原始的value，也包含了计算后的值。
			return {
				value: value,
				index: index++,
				criteria: iteratee(value, key, list)
			};
		}).sort(function(left, right) {
			var a = left.criteria;
			var b = right.criteria;
			if (a !== b) {
				if (a > b || a === void 0) return 1;
				if (a < b || b === void 0) return -1;
			}
			return left.index - right.index;
		}), 'value');
	};

	// An internal function used for aggregate "group by" operations.、
	// 内部函数用于聚合“组”操作
	var group = function(behavior, partition) {
		return function(obj, iteratee, context) {
			var result = partition ? [
				[],
				[]
			] : {};
			//这里的cb可以将比如属性length转成function.
			iteratee = cb(iteratee, context);
			_.each(obj, function(value, index) {
				var key = iteratee(value, index, obj);
				behavior(result, value, key);
			});
			return result;
		};
	};

	// Groups the object's values by a criterion. Pass either a string attribute
	// to group by, or a function that returns the criterion.
	// 按属性或运算结果分组。
	_.groupBy = group(function(result, value, key) {
		if (_.has(result, key)) result[key].push(value);
		else result[key] = [value];
	});

	// testFun(function(){
	// 	return _.groupBy(['one', 'two', 'three'], 'length');
	// })()

	// Indexes the object's values by a criterion, similar to `groupBy`, but for
	// when you know that your index values will be unique.
	// 与上面的区别是每组只给一个值。
	_.indexBy = group(function(result, value, key) {
		result[key] = value;
	});

	// testFun(function(){
	// 	var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}, {name: 'curly1', age: 60}];
	// 	return _.indexBy(stooges, 'age');
	// })();


	// Counts instances of an object that group by a certain criterion. Pass
	// either a string attribute to count by, or a function that returns the
	// criterion.
	// 返回每组的数量
	_.countBy = group(function(result, value, key) {
		if (_.has(result, key)) result[key]++;
		else result[key] = 1;
	});

	var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
	//???对这个正则的解释，以及字符编码的问题，可以看这里：https://www.zhihu.com/question/38324041
	//


	// Safely create a real, live array from anything iterable.
	// 把一个可迭代的东西转成array.如果原来是则返回一个新的。
	_.toArray = function(obj) {
		if (!obj) return [];
		if (_.isArray(obj)) return slice.call(obj);
		if (_.isString(obj)) {
			// Keep surrogate pair characters together???
			//字符串变数组 'hello'=>['h','e','l','l','0'];
			return obj.match(reStrSymbol);
		}
		if (isArrayLike(obj)) return _.map(obj, _.identity);
		return _.values(obj);
	};

	// testFun(function(){
	// 	return _.toArray('abcd,888***');
	// })();

	// Return the number of elements in an object.
	// 返回属性数量。数组长度。
	_.size = function(obj) {
		if (obj == null) return 0;
		return isArrayLike(obj) ? obj.length : _.keys(obj).length;
	};

	// Split a collection into two arrays: one whose elements all satisfy the given
	// predicate, and one whose elements all do not satisfy the predicate.
	// 将满足的和不满足的放到两个数组中。
	_.partition = group(function(result, value, pass) {
		result[pass ? 0 : 1].push(value);
	}, true);

	// Array Functions
	// ---------------
	// Array函数。

	// Get the first element of an array. Passing **n** will return the first N
	// values in the array. Aliased as `head` and `take`. The **guard** check
	// allows it to work with `_.map`.
	// 第一个或返回前n个。
	_.first = _.head = _.take = function(array, n, guard) {
		if (array == null || array.length < 1) return void 0;
		if (n == null || guard) return array[0];
		return _.initial(array, array.length - n);
	};

	// testFun(function() {
	// 		return _.first([5, 4, 3, 2, 1], 3);
	// 	})()


	// Returns everything but the last entry of the array. Especially useful on
	// the arguments object. Passing **n** will return all the values in
	// the array, excluding the last N.
	// 排除后面的n个元素。
	_.initial = function(array, n, guard) {
		return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
	};

	// Get the last element of an array. Passing **n** will return the last N
	// values in the array.
	// 返回后面的n个元素。
	_.last = function(array, n, guard) {
		if (array == null || array.length < 1) return void 0;
		if (n == null || guard) return array[array.length - 1];
		return _.rest(array, Math.max(0, array.length - n));
	};

	// Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
	// Especially useful on the arguments object. Passing an **n** will return
	// the rest N values in the array.
	// 除了前n个之外的所有。
	_.rest = _.tail = _.drop = function(array, n, guard) {
		return slice.call(array, n == null || guard ? 1 : n);
	};

	// Trim out all falsy values from an array.
	// 返回所有真值。Boolen是一个判断是否为真值的原生函数。
	_.compact = function(array) {
		return _.filter(array, Boolean);
	};

	// Internal implementation of a recursive `flatten` function.
	// 降维。
	// 
	/**
	 * [flatten description]
	 * @param  {[type]} input   [要降维的数组]
	 * @param  {[type]} shallow [如果为true的话表示只降一维]
	 * @param  {[type]} strict  [如果为true的话，表示只要展开的项，不要无法展开的基本类型。通常与shallow，true一起使用]
	 * @param  {[type]} output  [需要注意output。传入的是对象。作为引用类型，递归的函数内修改了它，所有的它的都修改了。]
	 * @return {[type]}         [description]
	 */
	var flatten = function(input, shallow, strict, output) {
		output = output || [];
		var idx = output.length;
		for (var i = 0, length = getLength(input); i < length; i++) {
			var value = input[i];
			//对数组值的处理。分为降多维和降一维两种处理。
			if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
				// Flatten current level of array or arguments object.
				// shallow为true的话只降一维。默认false.
				if (shallow) {
					var j = 0,
						len = value.length;
					while (j < len) output[idx++] = value[j++];
				} else {
					// 递归调用。将vue值降维。
					flatten(value, shallow, strict, output);
					idx = output.length;
				}
				//对基础类型的处理。是否保留基础类型的值。
			} else if (!strict) {
				output[idx++] = value;
			}
		}
		return output;
	};

	// Flatten out an array, either recursively (by default), or just one level.
	// 降维。默认降至一维，降到底。shallow参数为true，则只降一维。
	_.flatten = function(array, shallow) {
		return flatten(array, shallow, false);
	};

	// Return a version of the array that does not contain the specified value(s).
	// 返回一个删除所有values值后的 array副本。（注：使用===表达式做相等测试。）
	_.without = restArgs(function(array, otherArrays) {
		return _.difference(array, otherArrays);
	});

	// Produce a duplicate-free version of the array. If the array has already
	// been sorted, you have the option of using a faster algorithm.
	// Aliased as `unique`.
	// 返回 array去重后的副本, 使用 === 做相等测试.
	//  如果您确定 array 已经排序, 那么给 isSorted 参数传递 true值, 此函数将运行的更快的算法. 
	//  如果要处理对象元素, 传参 iterator 来获取要对比的属性.
	_.uniq = _.unique = function(array, isSorted, iteratee, context) {
		//对第二个参数的处理。如果然没传，后面的值依次顶上来。
		if (!_.isBoolean(isSorted)) {
			context = iteratee;
			iteratee = isSorted;
			isSorted = false;
		}
		if (iteratee != null) iteratee = cb(iteratee, context);
		//过滤后的原始值（返回值）
		var result = [];
		// 过滤后的计算值。
		var seen = [];
		for (var i = 0, length = getLength(array); i < length; i++) {
			var value = array[i],
				computed = iteratee ? iteratee(value, i, array) : value;
			//排序好的
			if (isSorted) {
				//!i即i为0的时候 直接push
				//这里的seen不是当数组用，而是当一个标识。seen是上一个计算值。当computed不等于上一个计算值。才push。
				if (!i || seen !== computed) result.push(value);
				seen = computed;
				//如果有计算函数的。
			} else if (iteratee) {
				if (!_.contains(seen, computed)) {
					seen.push(computed);
					result.push(value);
				}
				//原始的去重复。
			} else if (!_.contains(result, value)) {
				result.push(value);
			}
		}
		return result;
	};

	// Produce an array that contains the union: each distinct element from all of
	// the passed-in arrays.
	// 返回传入的 arrays（数组）并集：
	// 按顺序返回，返回数组的元素是唯一的，可以传入一个或多个 arrays（数组）。
	_.union = restArgs(function(arrays) {
		return _.uniq(flatten(arrays, true, true));
	});

	// Produce an array that contains every item shared between all the
	// passed-in arrays.
	// 交集
	_.intersection = function(array) {
		var result = [];
		var argsLength = arguments.length;
		for (var i = 0, length = getLength(array); i < length; i++) {
			var item = array[i];
			if (_.contains(result, item)) continue;
			var j;
			//不在任何一个数组就break.
			for (j = 1; j < argsLength; j++) {
				if (!_.contains(arguments[j], item)) break;
			}
			if (j === argsLength) result.push(item);
		}
		return result;
	};

	// Take the difference between one array and a number of other arrays.
	// Only the elements present in just the first array will remain.
	// 比较两个数组中的值。只在第一个数组不在第二个的能留下。差集？

	// setTimeout(function() {
	// 		console.log(_.difference([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2], [7, 8], 9));
	// 	}, 0)
	_.difference = restArgs(function(array, rest) {

		//比如 _.difference([1,2,3],[3,4],[1,4],5);  通过restArgs函数变成 了([1,2,3],[[3,4],[1,4],5]) 
		//所以要降维。把rest变成 [3,4,1,4]这样子。
		//降维，只降一维。不保留原始类型的值，也就是说传入的参数不是array就不要这个参数。
		rest = flatten(rest, true, true);
		return _.filter(array, function(value) {
			//返回没在rest中的值。
			return !_.contains(rest, value);
		});
	});

	// Complement of _.zip. Unzip accepts an array of arrays and groups
	// each array's elements on shared indices.
	// 将 每个arrays中相应位置的值合并在一起。
	// 在合并分开保存的数据时很有用. 如果你用来处理矩阵嵌套数组时, _.zip.apply 可以做类似的效果。
	_.unzip = function(array) {
		//以最大的一个的长度为length
		var length = array && _.max(array, getLength).length || 0;
		var result = Array(length);

		for (var index = 0; index < length; index++) {
			//???注意_.pluck
			result[index] = _.pluck(array, index);
		}
		return result;
	};

	// Zip together multiple lists into a single array -- elements that share
	// an index go together.
	// 多个参数变成一个。
	_.zip = restArgs(_.unzip);

	// Converts lists into objects. Pass either a single array of `[key, value]`
	// pairs, or two parallel arrays of the same length -- one of keys, and one of
	// the corresponding values. Passing by pairs is the reverse of _.pairs.
	// 将数组转换为对象。
	// 传递任何一个单独[key, value]对的列表，或者一个键的列表和一个值得列表。 
	// 如果存在重复键，最后一个值将被返回。
	_.object = function(list, values) {
		var result = {};
		for (var i = 0, length = getLength(list); i < length; i++) {
			if (values) {
				result[list[i]] = values[i];
			} else {
				result[list[i][0]] = list[i][1];
			}
		}
		return result;
	};

	// Generator function to create the findIndex and findLastIndex functions.
	// 生成一个函数来返回第一个或最后一个满足的index。
	var createPredicateIndexFinder = function(dir) {
		return function(array, predicate, context) {
			predicate = cb(predicate, context);
			var length = getLength(array);
			var index = dir > 0 ? 0 : length - 1;
			for (; index >= 0 && index < length; index += dir) {
				if (predicate(array[index], index, array)) return index;
			}
			return -1;
		};
	};

	// Returns the first index on an array-like that passes a predicate test.
	// 返回第一个return true的index。正向，反向。
	_.findIndex = createPredicateIndexFinder(1);
	_.findLastIndex = createPredicateIndexFinder(-1);

	// Use a comparator function to figure out the smallest index at which
	// an object should be inserted so as to maintain order. Uses binary search.
	// 使用二分查找确定value在list中的位置序号，value按此序号插入能保持list原有的排序
	// _.sortedIndex(list, value, [iteratee], [context]) 
	// 用一个比较函数算出最小的索引。插入一个有序数组。
	// 使用二分法。
	_.sortedIndex = function(array, obj, iteratee, context) {
		iteratee = cb(iteratee, context, 1);
		var value = iteratee(obj);
		var low = 0,
			high = getLength(array);
		while (low < high) {
			var mid = Math.floor((low + high) / 2);
			if (iteratee(array[mid]) < value) low = mid + 1;
			else high = mid;
		}
		return low;
	};

	// Generator function to create the indexOf and lastIndexOf functions.
	// 用于生成indexOf和lastIndexOf的函数。
	// 如果fromIndex是负数，作为偏移量。
	// 正向。如果算出来的小于0,则搜索整个数组。
	// 反向。如果算出来的小于0,返回-1;

	var createIndexFinder = function(dir, predicateFind, sortedIndex) {

		// idx可能是数字，也可能是布尔值。
		// 是数字的时候表示fromIndex.布尔值的时候表示是isSorted
		return function(array, item, idx) {
			var i = 0,
				length = getLength(array);
			//如果第三个参数是数字
			if (typeof idx == 'number') {

				if (dir > 0) {
					i = idx >= 0 ? idx : Math.max(idx + length, i);
				} else {
					length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
				}
			//第三个参数是bool值，是否排序。
			} else if (sortedIndex && idx && length) {
				//判断如果item在array中能排到哪个位置。再用item与那个位置的值做比较。如果相等，说明在里面。
				//不过有这个就没有fromIndex了
				idx = sortedIndex(array, item);
				return array[idx] === item ? idx : -1;
			}
			//NAN
			if (item !== item) {
				idx = predicateFind(slice.call(array, i, length), _.isNaN);
				return idx >= 0 ? idx + i : -1;
			}
			//正常遍历
			for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
				if (array[idx] === item) return idx;
			}
			return -1;
		};
	};



	// Return the position of the first occurrence of an item in an array,
	// or -1 if the item is not included in the array.
	// If the array is large and already in sort order, pass `true`
	// for **isSorted** to use binary search.
	// 返回array中第一次出现的位置。正向。反向。
	// 没找到则返回-1。
	// 如果是很大的有序数组。。。
	// 
	_.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
	_.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

	// Generate an integer Array containing an arithmetic progression. A port of
	// the native Python `range()` function. See
	// [the Python documentation](http://docs.python.org/library/functions.html#range).
	// 一个用来创建整数灵活编号的列表的函数，便于each 和 map循环。
	// 如果省略start则默认为 0；step 默认为 1.返回一个从start 到stop的整数的列表，用step来增加 （或减少）独占。
	// 值得注意的是，如果stop值在start前面（也就是stop值小于start值），那么值域会被认为是零长度，而不是负增长。
	// -如果你要一个负数的值域 ，请使用负数step.
	_.range = function(start, stop, step) {
		//参数转换　将_.range(3)转化成_.range(0,3)的效果。
		if (stop == null) {
			stop = start || 0;
			start = 0;
		}
		//判断是正向还是逆向
		if (!step) {
			step = stop < start ? -1 : 1;
		}

		var length = Math.max(Math.ceil((stop - start) / step), 0);
		var range = Array(length);

		for (var idx = 0; idx < length; idx++, start += step) {
			range[idx] = start;
		}

		return range;
	};

	// Split an **array** into several arrays containing **count** or less elements
	// of initial array.
	// 一个大数组分成几个小数组
	_.chunk = function(array, count) {
		if (count == null || count < 1) return [];

		var result = [];
		var i = 0,
			length = array.length;
		while (i < length) {
			result.push(slice.call(array, i, i += count));
		}
		return result;
	};

	// Function (ahem) Functions
	// ------------------

	// Determines whether to execute a function as a constructor
	// or a normal function with the provided arguments.
	// 决定按构造器还是按普通函数执行。

	var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
		// 如果callingContext不是boundFunc的实例。运行sourceFunc.
		// callingContext instanceof boundFunc是判断以new _.bind()() 方式调用.		

		if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
		var self = baseCreate(sourceFunc.prototype);
		//有些函数是直接返回obj。
		var result = sourceFunc.apply(self, args);
		if (_.isObject(result)) return result;
		return self;
	};

	// Create a function bound to a given object (assigning `this`, and arguments,
	// optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
	// available.
	// 创造一个绑定在给的对象上运行的函数。
	// js原生的bind函数。　使用new的时候绑定的对象是无效的。
	_.bind = restArgs(function(func, context, args) {

		if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
		var bound = restArgs(function(callArgs) {
			return executeBound(func, bound, context, this, args.concat(callArgs));
		});
		return bound;
	});



	// Partially apply a function by creating a version that has had some of its
	// arguments pre-filled, without changing its dynamic `this` context. _ acts
	// as a placeholder by default, allowing any combination of arguments to be
	// pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
	// 偏函数与函数柯里化？
	// 局部应用一个函数填充在任意个数的 arguments，不改变其动态this值。和bind方法很相近。你可以传递_ 给arguments列表来指定一个不预先填充，但在调用时提供的参数。
	// 返回一个函数。预先填充一些参数。对于不用填充的参数位置，使用_占位。
	// 实际运行的时候，会把两次传递的参数拼成一个参数，然后再运行。
	// var add = function(a, b,c,d,e) { return a+b+c+d+e; };
	//  add20 = _.partial(add, _, 2,_,4,_);
	// add20(1,3,5);
	// 注意第一次传入的参数是包含占位符的。
	// 第二次传入的是不包含占位符的。
	// 所以第二次的每一个参数都要起到作用。替换掉第一个参数中的占位符号。
	_.partial = restArgs(function(func, boundArgs) {

		var placeholder = _.partial.placeholder;
		var bound = function() {

			var position = 0,
				length = boundArgs.length;
			//第一次传入的参数的长度。
			var args = Array(length);

			for (var i = 0; i < length; i++) {
				args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
			}
			while (position < arguments.length) args.push(arguments[position++]);
			return executeBound(func, bound, this, this, args);
		};
		return bound;
	});

	_.partial.placeholder = _;

	// Bind a number of an object's methods to that object. Remaining arguments
	// are the method names to be bound. Useful for ensuring that all callbacks
	// defined on an object belong to it.
	// 将多个方法绑定到obj上。注意传入的参数是obj中的函数名。
	// 	window.a = 'a in global';
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
	_.bindAll = restArgs(function(obj, keys) {
		keys = flatten(keys, false, false);
		var index = keys.length;
		if (index < 1) throw new Error('bindAll must be passed function names');
		while (index--) {
			var key = keys[index];
			obj[key] = _.bind(obj[key], obj);
		}
	});

	// Memoize an expensive function by storing its results.
	// 缓存结果
	// 缓存某些代价昂贵的函数的结果。
	// hasher是自定义的计算缓存key的函数。
	// 	function add(n) {
	// 	console.log(n-1,n-2);
	// 	return n < 2 ? n : add(n - 1) + add(n - 2);
	// };
	// var goodAdd = _.memoize(function(n) {
	// 	console.log(n-1,n-2);
	// 	return n < 2 ? n : goodAdd(n - 1) + goodAdd(n - 2);
	// });
	// add(5)
	// goodAdd(5);
	_.memoize = function(func, hasher) {
		var memoize = function(key) {
			var cache = memoize.cache;
			var address = '' + (hasher ? hasher.apply(this, arguments) : key);
			if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
			return cache[address];
		};
		memoize.cache = {};
		return memoize;
	};

	// Delays a function for the given number of milliseconds, and then calls
	// it with the arguments supplied.
	// 延迟执行。
	_.delay = restArgs(function(func, wait, args) {
		return setTimeout(function() {
			return func.apply(null, args);
		}, wait);
	});

	// Defers a function, scheduling it to run after the current call stack has
	// cleared.
	// 相当于 timeout0
	_.defer = _.partial(_.delay, _, 1);

	// Returns a function, that, when invoked, will only be triggered at most once
	// during a given window of time. Normally, the throttled function will run
	// as much as it can, without ever going more than once per `wait` duration;
	// but if you'd like to disable the execution on the leading edge, pass
	// `{leading: false}`. To disable execution on the trailing edge, ditto.
	// 默认立即执行，{leading: false}过一个wait时间后执行。
	// 如果禁用最后一次执行，是不会使用timer的。触发方式是每次调用函数。判断与上次执行的时间差。也就是对函数的调用一停止,就不会有下一次执行了。
	// 不禁用的话。每次执行函数。就会生成一个timer。并清除上一个timer。
	// 计算下次执行还有多少时间。所以在两次间隔之间调用函数，然后停止调用函数，等到时间间隔到了，还会执行一次。
	// 节流
	_.throttle = function(func, wait, options) {
		var timeout, context, args, result;
		// 上次运行的时间戳
		var previous = 0;
		if (!options) options = {};

		var later = function() {
			previous = options.leading === false ? 0 : _.now();
			timeout = null;
			result = func.apply(context, args);
			if (!timeout) context = args = null;
		};

		var throttled = function() {
			var now = _.now();
			//第一次运行的时候会判断。
			if (!previous && options.leading === false) previous = now;
			var remaining = wait - (now - previous);
			context = this;
			args = arguments;
			//remaining>wait表示系统时间调整过，时间异常的情况
			//另外这个里面的执行并不是执行timer。而是把timer里的内容直接在里面执行一遍。主要是考虑到不设置timer的情况下。
			if (remaining <= 0 || remaining > wait) {
				console.log(timeout, 'timeout')
				if (timeout) {
					clearTimeout(timeout);
					timeout = null;
				}
				previous = now;
				result = func.apply(context, args);
				if (!timeout) context = args = null;

			} else if (!timeout && options.trailing !== false) {
				console.log(11);
				timeout = setTimeout(later, remaining);
			}
			return result;
		};

		throttled.cancel = function() {
			clearTimeout(timeout);
			previous = 0;
			timeout = context = args = null;
		};

		return throttled;
	};

	// Returns a function, that, as long as it continues to be invoked, will not
	// be triggered. The function will be called after it stops being called for
	// N milliseconds. If `immediate` is passed, trigger the function on the
	// leading edge, instead of the trailing.
	// 防反跳。对于连续多次触发的处理。
	// 默认只有在触发间隔大于wait时才执行。两次触发时间相差大于wait，在前一次触发之后的wait时间执行。
	// 最后一个参数传递true。则是在第一次触发就执行。然后等待下一次触发间隔大于wait之后再触发时执行。
	_.debounce = function(func, wait, immediate) {
		var timeout, result;

		var later = function(context, args) {
			timeout = null;
			if (args) result = func.apply(context, args);
		};

		var debounced = restArgs(function(args) {
			if (timeout) clearTimeout(timeout);
			if (immediate) {
				//如果当前有等待中的定时器，则callNow为false。没有则为true。
				var callNow = !timeout;
				//这个定时器单纯起定时作用。因为later没有传递参数。所以执行later只是用于将timeout变成null。以为下次执行做好准备。
				timeout = setTimeout(later, wait);
				//之前没有等待中的定时器，直接执行
				if (callNow) result = func.apply(this, args);
			} else {
				//使用delay，可以传递参数到定时器中
				timeout = _.delay(later, wait, this, args);
			}

			return result;
		});

		debounced.cancel = function() {
			clearTimeout(timeout);
			timeout = null;
		};

		return debounced;
	};

	// Returns the first function passed as an argument to the second,
	// allowing you to adjust arguments, run code before and after, and
	// conditionally execute the original function.
	// 第一个函数作为参数传递给第二个。
	_.wrap = function(func, wrapper) {
		return _.partial(wrapper, func);
	};

	// Returns a negated version of the passed-in predicate.
	// 返回一个函数。与传入的原函数结果取反。
	_.negate = function(predicate) {
		return function() {
			return !predicate.apply(this, arguments);
		};
	};

	// Returns a function that is the composition of a list of functions, each
	// consuming the return value of the function that follows.
	// 从后往前，后一个结果作前一个的参数。f(g(h(x)));
	_.compose = function() {
		var args = arguments;
		var start = args.length - 1;
		return function() {
			var i = start;
			var result = args[start].apply(this, arguments);
			while (i--) result = args[i].call(this, result);
			return result;
		};
	};

	// Returns a function that will only be executed on and after the Nth call.
	// 运行了多少次之后才会有效果。
	_.after = function(times, func) {
		return function() {
			if (--times < 1) {
				return func.apply(this, arguments);
			}
		};
	};

	// Returns a function that will only be executed up to (but not including) the Nth call.
	// 返回一个函数只会执行小于times次。超过就返回最后一次运行的结果
	_.before = function(times, func) {
		var memo;
		return function() {
			if (--times > 0) {
				memo = func.apply(this, arguments);
			}
			if (times <= 1) func = null;
			return memo;
		};
	};

	// Returns a function that will be executed at most one time, no matter how
	// often you call it. Useful for lazy initialization.
	_.once = _.partial(_.before, 2);

	_.restArgs = restArgs;

	// Object Functions
	// ----------------


	// Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
	// ie9以下对一些内置的不可枚举属性的覆盖。比如{toString:123},原型中的toString是不可枚举的。这里我们自已定义的toString也循环不到了。要遍历这些属性。需要一个函数单独收集。
	var hasEnumBug = !{
		toString: null
	}.propertyIsEnumerable('toString');
	//哪些属性可能在这个bug的范围
	var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
		'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'
	];

	var collectNonEnumProps = function(obj, keys) {
		var nonEnumIdx = nonEnumerableProps.length;
		var constructor = obj.constructor;
		var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

		// Constructor is a special case.
		var prop = 'constructor';
		if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

		while (nonEnumIdx--) {
			prop = nonEnumerableProps[nonEnumIdx];
			if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
				keys.push(prop);
			}
		}
	};

	// Retrieve the names of an object's own properties.
	// Delegates to **ECMAScript 5**'s native `Object.keys`.
	// 获取object自已的所有属性名。
	// es5中有Object.keys。
	_.keys = function(obj) {
		if (!_.isObject(obj)) return [];
		if (nativeKeys) return nativeKeys(obj);
		var keys = [];
		for (var key in obj)
			if (_.has(obj, key)) keys.push(key);
			// Ahem, IE < 9.   ???
		if (hasEnumBug) collectNonEnumProps(obj, keys);
		return keys;
	};

	// Retrieve all the property names of an object.
	// 获取所有的key。
	_.allKeys = function(obj) {
		if (!_.isObject(obj)) return [];
		var keys = [];
		for (var key in obj) keys.push(key);
		// Ahem, IE < 9.
		if (hasEnumBug) collectNonEnumProps(obj, keys);
		return keys;
	};

	// Retrieve the values of an object's properties.
	// 获取一个object所有的值。
	_.values = function(obj) {
		var keys = _.keys(obj);
		var length = keys.length;
		var values = Array(length);
		for (var i = 0; i < length; i++) {
			values[i] = obj[keys[i]];
		}
		return values;
	};

	// Returns the results of applying the iteratee to each element of the object.
	// In contrast to _.map it returns an object.
	// 类似于_.map不同的是它的返回的是object
	_.mapObject = function(obj, iteratee, context) {
		iteratee = cb(iteratee, context);
		var keys = _.keys(obj),
			length = keys.length,
			results = {};
		for (var index = 0; index < length; index++) {
			var currentKey = keys[index];
			results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
		}
		return results;
	};

	// Convert an object into a list of `[key, value]` pairs.
	// The opposite of _.object.
	// 对象转键值对数组。
	_.pairs = function(obj) {
		var keys = _.keys(obj);
		var length = keys.length;
		var pairs = Array(length);
		for (var i = 0; i < length; i++) {
			pairs[i] = [keys[i], obj[keys[i]]];
		}
		return pairs;
	};

	// Invert the keys and values of an object. The values must be serializable.
	// 返回一个object副本，使其键（keys）和值（values）对换。
	// 对于这个操作，必须确保object里所有的值都是唯一的且可以序列号成字符串.
	_.invert = function(obj) {
		var result = {};
		var keys = _.keys(obj);
		for (var i = 0, length = keys.length; i < length; i++) {
			result[obj[keys[i]]] = keys[i];
		}
		return result;
	};

	// Return a sorted list of the function names available on the object.
	// Aliased as `methods`.
	// 返回所有方法名。并排序。
	_.functions = _.methods = function(obj) {
		var names = [];
		for (var key in obj) {
			if (_.isFunction(obj[key])) names.push(key);
		}
		return names.sort();
	};

	// An internal function for creating assigner functions.
	/**
	 * [createAssigner description]
	 * @param  {[type]} keysFunc [用于获取keys的函数：获取全部还是获取自有keys]
	 * @param  {[type]} defaults [是否覆盖已有的属性　传入true不覆盖　默认是覆盖的]
	 * @return {[type]}          [返回合并后的对象]
	 */
	var createAssigner = function(keysFunc, defaults) {
		return function(obj) {
			var length = arguments.length;
			if (defaults) obj = Object(obj); //???为什么要用这一句
			if (length < 2 || obj == null) return obj;
			for (var index = 1; index < length; index++) {
				var source = arguments[index],
					keys = keysFunc(source),
					l = keys.length;
				for (var i = 0; i < l; i++) {
					var key = keys[i];
					if (!defaults || obj[key] === void 0) obj[key] = source[key];
				}
			}
			return obj;
		};
	};

	// Extend a given object with all the properties in passed-in object(s).
	_.extend = createAssigner(_.allKeys);

	// Assigns a given object with all the own properties in the passed-in object(s).
	// (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
	// 多个对象的传入一个对象的。
	_.extendOwn = _.assign = createAssigner(_.keys);

	// Returns the first key on an object that passes a predicate test.
	// 返回第一个满足的key。
	_.findKey = function(obj, predicate, context) {
		predicate = cb(predicate, context);
		var keys = _.keys(obj),
			key;
		for (var i = 0, length = keys.length; i < length; i++) {
			key = keys[i];
			if (predicate(obj[key], key, obj)) return key;
		}
	};

	// Internal pick helper function to determine if `obj` has key `key`.
	// 判断是否在obj中。
	var keyInObj = function(value, key, obj) {
		return key in obj;
	};

	// Return a copy of the object only containing the whitelisted properties.
	// 返回一个object副本，只过滤出keys(有效的键组成的数组)参数指定的属性值。
	// 或者接受一个判断函数，指定挑选哪个key。
	/**
	 * [description]
	 * @param  {[type]} obj      [传入要处理的对象]
	 * @param  {Object} keys)    [可以是多个属性名。也可以是方法名和context]
	 
	 * @return {[type]}          [description]
	 */
	_.pick = restArgs(function(obj, keys) {
		var result = {},
			iteratee = keys[0];
		if (obj == null) return result;
		if (_.isFunction(iteratee)) {
			//keys[1]当成context
			if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
			keys = _.allKeys(obj);
		} else {
			//如果直接传的key。那么迭代器就是检测是否在obj中的函数
			iteratee = keyInObj;
			//考虑传入参数(obj,['a','b'],['c,d'])的情况。会处理成[a,b,c,d];
			keys = flatten(keys, false, false);
			//???
			obj = Object(obj);
		}
		for (var i = 0, length = keys.length; i < length; i++) {
			var key = keys[i];
			var value = obj[key];
			if (iteratee(value, key, obj)) result[key] = value;
		}
		return result;
	});

	// Return a copy of the object without the blacklisted properties.
	// 上面一个函数的反操作。注意最后一句的不同。
	_.omit = restArgs(function(obj, keys) {
		var iteratee = keys[0],
			context;
		if (_.isFunction(iteratee)) {
			//返回不满足迭代器的函数
			iteratee = _.negate(iteratee);
			if (keys.length > 1) context = keys[1];
		} else {
			keys = _.map(flatten(keys, false, false), String);
			iteratee = function(value, key) {
				return !_.contains(keys, key);
			};
		}
		return _.pick(obj, iteratee, context);
	});

	// Fill in a given object with default properties.
	// 用defaults对象填充object 中的undefined属性。 并且返回这个object。
	// 一旦这个属性被填充，再使用defaults方法将不会有任何效果。???
	_.defaults = createAssigner(_.allKeys, true);

	// Creates an object that inherits from the given prototype object.
	// If additional properties are provided then they will be added to the
	// created object.
	// 创建具有给定原型的新对象， 可选附加props 作为 own的属性。
	_.create = function(prototype, props) {
		var result = baseCreate(prototype);
		if (props) _.extendOwn(result, props);
		return result;
	};

	// Create a (shallow-cloned) duplicate of an object.
	// 返回一个对象的浅复制
	_.clone = function(obj) {
		//不是对象，返回原值
		if (!_.isObject(obj)) return obj;
		//数组用slice。对象用extend。
		return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
	};

	// Invokes interceptor with the obj, and then returns obj.
	// The primary purpose of this method is to "tap into" a method chain, in
	// order to perform operations on intermediate results within the chain.
	// 用 object作为参数来调用函数interceptor，然后返回object。这种方法的主要意图是作为函数链式调用 的一环, 为了对此对象执行操作并返回对象本身。
	_.tap = function(obj, interceptor) {
		interceptor(obj);
		return obj;
	};

	// Returns whether an object has a given set of `key:value` pairs.
	// 检测一个对象是否有给的键值对
	_.isMatch = function(object, attrs) {
		var keys = _.keys(attrs),
			length = keys.length;
		//obj为空，arrts为空数组时返回true.
		if (object == null) return !length;
		//???
		var obj = Object(object);
		for (var i = 0; i < length; i++) {
			var key = keys[i];
			//值不一样或不存在key返回false.
			if (attrs[key] !== obj[key] || !(key in obj)) return false;
		}
		return true;
	};

	// Internal recursive comparison function for `isEqual`.
	// 内部的递归比较方法。
	var eq, deepEq;
	eq = function(a, b, aStack, bStack) {
		// Identical objects are equal. `0 === -0`, but they aren't identical.
		// See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
		//　+0 === -0是true。　但是这里需要把它们视为不相等。1/+0等于Infinity。1/-0等于-Infinity。
		if (a === b) return a !== 0 || 1 / a === 1 / b;
		// `null` or `undefined` only equal to itself (strict comparison).
		if (a == null || b == null) return false;
		// `NaN`s are equivalent, but non-reflexive.
		// 这里把NaN等于NaN看成相等的。
		if (a !== a) return b !== b;
		// Exhaust primitive checks
		var type = typeof a;
		//对于a,b不相等的。如果双方是对象或函数。再深入比较
		if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
		return deepEq(a, b, aStack, bStack);
	};
	// console.log(eq(0,-0)) //false
	// console.log(eq(NaN,NaN)) //true
	// console.log(eq(null,1)) //false


	// Internal recursive comparison function for `isEqual`.
	deepEq = function(a, b, aStack, bStack) {
		// Unwrap any wrapped objects.
		if (a instanceof _) a = a._wrapped;
		if (b instanceof _) b = b._wrapped;
		// Compare `[[Class]]` names.
		var className = toString.call(a);
		if (className !== toString.call(b)) return false;
		switch (className) {
			// Strings, numbers, regular expressions, dates, and booleans are compared by value.
			case '[object RegExp]':
				// RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
			case '[object String]':
				// Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
				// equivalent to `new String("5")`.
				// 原始值和包装对象下的原始值判断相等。
				return '' + a === '' + b;
			case '[object Number]':
				// `NaN`s are equivalent, but non-reflexive.
				// Object(NaN) is equivalent to NaN.
				// 对NaN的处理
				if (+a !== +a) return +b !== +b;
				// An `egal` comparison is performed for other numeric values.
				return +a === 0 ? 1 / +a === 1 / b : +a === +b;
			case '[object Date]':
			case '[object Boolean]':
				// Coerce dates and booleans to numeric primitive values. Dates are compared by their
				// millisecond representations. Note that invalid dates with millisecond representations
				// of `NaN` are not equivalent.
				// Date和Boolean转化成数字来比较。Date转化成其ms值。　无效Date转化成NaN。
				return +a === +b;
			case '[object Symbol]':
				//对Symbol的处理
				return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
		}

		var areArrays = className === '[object Array]';
		//不是数组
		if (!areArrays) {
			if (typeof a != 'object' || typeof b != 'object') return false;

			// Objects with different constructors are not equivalent, but `Object`s or `Array`s
			// from different frames are.
			// constructor不相等的对象是不相等的。
			// 但是如果它们是不同的frames中的，则是相等的。
			var aCtor = a.constructor,
				bCtor = b.constructor;
			//???
			if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
					_.isFunction(bCtor) && bCtor instanceof bCtor) && ('constructor' in a && 'constructor' in b)) {
				return false;
			}
		}
		// Assume equality for cyclic structures. The algorithm for detecting cyclic
		// structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

		// Initializing stack of traversed objects.
		// It's done here since we only need them for objects and arrays comparison.
		aStack = aStack || [];
		bStack = bStack || [];
		var length = aStack.length;
		while (length--) {
			// Linear search. Performance is inversely proportional to the number of
			// unique nested structures.
			if (aStack[length] === a) return bStack[length] === b;
		}

		// Add the first object to the stack of traversed objects.
		aStack.push(a);
		bStack.push(b);

		// Recursively compare objects and arrays.
		if (areArrays) {
			// Compare array lengths to determine if a deep comparison is necessary.
			length = a.length;
			if (length !== b.length) return false;
			// Deep compare the contents, ignoring non-numeric properties.
			while (length--) {
				if (!eq(a[length], b[length], aStack, bStack)) return false;
			}
		} else {
			// Deep compare objects.
			var keys = _.keys(a),
				key;
			length = keys.length;
			// Ensure that both objects contain the same number of properties before comparing deep equality.
			if (_.keys(b).length !== length) return false;
			while (length--) {
				// Deep compare each member
				key = keys[length];
				if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
			}
		}
		// Remove the first object from the stack of traversed objects.
		aStack.pop();
		bStack.pop();
		return true;
	};

	// Perform a deep comparison to check if two objects are equal.
	_.isEqual = function(a, b) {
		return eq(a, b);
	};

	// Is a given array, string, or object empty?
	// An "empty" object has no enumerable own-properties.
	// 检测数组或对象是否为空。
	// 空obj是无自有属性。
	_.isEmpty = function(obj) {
		if (obj == null) return true;
		if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
		return _.keys(obj).length === 0;
	};

	// Is a given value a DOM element?
	// 判断是否dom节点
	_.isElement = function(obj) {
		return !!(obj && obj.nodeType === 1);
	};

	// Is a given value an array?
	// Delegates to ECMA5's native Array.isArray
	// 判断Array。如果没有es5中的原生isArray就自定义一个。
	_.isArray = nativeIsArray || function(obj) {
		return toString.call(obj) === '[object Array]';
	};

	// Is a given variable an object?
	// 判断object//!!obj是针对null的情况？console.log(_.isObject(null));
	_.isObject = function(obj) {
		var type = typeof obj;
		return type === 'function' || type === 'object' && !!obj;
	};

	// Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
	// 添加一批isType的函数。通过判断[[class]]
	_.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function(name) {
		_['is' + name] = function(obj) {
			return toString.call(obj) === '[object ' + name + ']';
		};
	});

	// Define a fallback version of the method in browsers (ahem, IE < 9), where
	// there isn't any inspectable "Arguments" type.
	// 对上面的_.isArguments进行补充。主要是ie9下。arguements的返回有问题???
	if (!_.isArguments(arguments)) {
		_.isArguments = function(obj) {
			return _.has(obj, 'callee');
		};
	}

	// Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
	// IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
	// ???
	var nodelist = root.document && root.document.childNodes;
	if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
		_.isFunction = function(obj) {
			return typeof obj == 'function' || false;
		};
	}

	// Is a given object a finite number?
	// isFinite是js原生的。
	_.isFinite = function(obj) {
		//???为什么专门把isSymbol放在这里
		return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj));
	};


	// Is the given value `NaN`?
	// 判断是否NaN
	_.isNaN = function(obj) {
		return _.isNumber(obj) && isNaN(obj);
	};

	// Is a given value a boolean?
	// 判断Boolean
	_.isBoolean = function(obj) {
		return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
	};

	// Is a given value equal to null
	// 判断null
	_.isNull = function(obj) {
		return obj === null;
	};

	// Is a given variable undefined
	// 判断undefined
	// 注意undefined在什么情况下可以被赋值???
	_.isUndefined = function(obj) {
		return obj === void 0;
	};

	// Shortcut function for checking if an object has a given property directly
	// on itself (in other words, not on a prototype).
	// 判断是否有该自有属性。
	// path这个参数。　[a,b]。表示a下面是否有b。
	_.has = function(obj, path) {
		if (!_.isArray(path)) {
			return obj != null && hasOwnProperty.call(obj, path);
		}
		var length = path.length;
		for (var i = 0; i < length; i++) {
			var key = path[i];
			if (obj == null || !hasOwnProperty.call(obj, key)) {
				return false;
			}
			obj = obj[key];
		}
		return !!length;
	};

	//测试
	// setTimeout(function(){
	// 	var a = {
	// 		'a':{'b':1},
	// 		b:2,
	// 		c:3
	// 	}
	// 	console.log(_.has(a,['a','b']))
	// }, 0);

	// Utility Functions
	// -----------------

	// Run Underscore.js in *noConflict* mode, returning the `_` variable to its
	// previous owner. Returns a reference to the Underscore object.
	// 放弃对_的使用。 var underscore = _.noConflict
	_.noConflict = function() {
		root._ = previousUnderscore;
		return this;
	};

	// Keep the identity function around for default iteratees.
	// 使默认迭代器保持职责的函数。
	_.identity = function(value) {
		return value;
	};

	// Predicate-generating functions. Often useful outside of Underscore.
	// 返回一个返回某个值的函数。某个常量。
	_.constant = function(value) {
		return function() {
			return value;
		};
	};

	_.noop = function() {};

	//直接返回某个属性的值或某个路径的值。
	_.property = function(path) {
		if (!_.isArray(path)) {
			return shallowProperty(path);
		}
		return function(obj) {
			return deepGet(obj, path);
		};
	};

	// Generates a function for a given object that returns a given property.
	// 生成一个函数用来查找某obj中的某个属性或路径。
	_.propertyOf = function(obj) {
		if (obj == null) {
			return function() {};
		}
		return function(path) {
			return !_.isArray(path) ? obj[path] : deepGet(obj, path);
		};
	};

	// Returns a predicate for checking whether an object has a given set of
	// `key:value` pairs.
	// 返回一个函数检测一个对象中是否有给的键值对。
	_.matcher = _.matches = function(attrs) {
		attrs = _.extendOwn({}, attrs);
		return function(obj) {
			return _.isMatch(obj, attrs);
		};
	};

	// Run a function **n** times.
	// 执行n次某个函数。每次都会传入序号。
	_.times = function(n, iteratee, context) {
		var accum = Array(Math.max(0, n));
		iteratee = optimizeCb(iteratee, context, 1);
		for (var i = 0; i < n; i++) accum[i] = iteratee(i);
		return accum;
	};

	// Return a random integer between min and max (inclusive).
	// 返回范围内一个随机int值。大于等于min小于等于max.
	_.random = function(min, max) {
		if (max == null) {
			max = min;
			min = 0;
		}
		return min + Math.floor(Math.random() * (max - min + 1));
	};



	// A (possibly faster) way to get the current timestamp as an integer.
	// 获取当前的时间戳
	_.now = Date.now || function() {
		return new Date().getTime();
	};

	// List of HTML entities for escaping.
	// html字符转换
	var escapeMap = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
		'`': '&#x60;'
	};
	//调换
	var unescapeMap = _.invert(escapeMap);

	// Functions for escaping and unescaping strings to/from HTML interpolation.
	// html转义或反转义的函数。
	var createEscaper = function(map) {

		var escaper = function(match) {
			return map[match];
		};
		// Regexes for identifying a key that needs to be escaped.
		// 正则识别需要转义的字符。???
		// replace第二个参数可以是函数。
		var source = '(?:' + _.keys(map).join('|') + ')';

		var testRegexp = RegExp(source);
		var replaceRegexp = RegExp(source, 'g');
		// console.log(replaceRegexp, typeof testRegexp);
		return function(string) {
			string = string == null ? '' : '' + string;
			//匹配则替换
			return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
		};
	};
	_.escape = createEscaper(escapeMap);
	_.unescape = createEscaper(unescapeMap);


	// _.escape('Curly, Larry & Moe');

	// testFun(function(){
	// 		return _.escape('Curly, Larry & Moe');
	// })();

	// Traverses the children of `obj` along `path`. If a child is a function, it
	// is invoked with its parent as context. Returns the value of the final
	// child, or `fallback` if any child is undefined.
	// 如果指定的property 的值是一个函数，那么将在object上下文内调用它;否则，返回它。
	// 如果提供默认值，并且属性不存在，那么默认值将被返回。
	// 如果设置defaultValue是一个函数，它的结果将被返回。
	_.result = function(obj, path, fallback) {
		if (!_.isArray(path)) path = [path];
		var length = path.length;
		//如果第二个参数为空，则返回第三个参数或其运行后的结果。
		if (!length) {
			return _.isFunction(fallback) ? fallback.call(obj) : fallback;
		}
		for (var i = 0; i < length; i++) {
			var prop = obj == null ? void 0 : obj[path[i]];
			if (prop === void 0) {
				prop = fallback;
				//停止迭代
				i = length; // Ensure we don't continue iterating.
			}
			obj = _.isFunction(prop) ? prop.call(obj) : prop;
		}
		return obj;
	};



	// Generate a unique integer id (unique within the entire client session).
	// Useful for temporary DOM ids.
	// 生成一个全局的id。有前缀就加前缀。居然用了个全局变量。
	var idCounter = 0;
	_.uniqueId = function(prefix) {
		var id = ++idCounter + '';
		return prefix ? prefix + id : id;
	};

	// By default, Underscore uses ERB-style template delimiters, change the
	// following template settings to use alternative delimiters.
	// 
	// 默认使用erb风格。可通过修改设置其他替代风格的。
	// 1.eval 2.插值 3.转义
	_.templateSettings = {
		evaluate: /<%([\s\S]+?)%>/g,
		interpolate: /<%=([\s\S]+?)%>/g,
		escape: /<%-([\s\S]+?)%>/g
	};

	// When customizing `templateSettings`, if you don't want to define an
	// interpolation, evaluation or escaping regex, we need one that is
	// guaranteed not to match.
	// 自定义的时候，如果你不需要某个功能的正则。也需要有一个默认的来match。来保证功能正常。
	var noMatch = /(.)^/;

	// Certain characters need to be escaped so that they can be put into a
	// string literal.
	var escapes = {
		"'": "'",
		'\\': '\\',
		'\r': 'r',
		'\n': 'n',
		'\u2028': 'u2028',
		'\u2029': 'u2029'
	};

	var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

	var escapeChar = function(match) {
		return '\\' + escapes[match];
	};

	// JavaScript micro-templating, similar to John Resig's implementation.
	// Underscore templating handles arbitrary delimiters, preserves whitespace,
	// and correctly escapes quotes within interpolated code.
	// NB: `oldSettings` only exists for backwards compatibility.
	// 模板引擎
	_.template = function(text, settings, oldSettings) {
		//参数提前
		if (!settings && oldSettings) settings = oldSettings;
		//合并
		settings = _.defaults({}, settings, _.templateSettings);

		// Combine delimiters into one regular expression via alternation.
		// 分隔符处理。
		var matcher = RegExp([
			(settings.escape || noMatch).source,
			(settings.interpolate || noMatch).source,
			(settings.evaluate || noMatch).source
		].join('|') + '|$', 'g');

		// Compile the template source, escaping string literals appropriately.
		var index = 0;
		var source = "__p+='";
		//注意replace函数传入的回调函数的参数。
		//参考https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/replace
		text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
			// 没有匹配上的转义一下
			source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
			index = offset + match.length;
			//对三种匹配正则的不同处理
			if (escape) {
				source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
			} else if (interpolate) {
				source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
			} else if (evaluate) {
				source += "';\n" + evaluate + "\n__p+='";
			}

			// Adobe VMs need the match returned to produce the correct offset.
			// 将原来的match值返回去替换，使offset在正确的位置。
			return match;
		});
		source += "';\n";

		// If a variable is not specified, place data values in local scope.
		// 注意with的用法 
		if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

		//这里的__t用来作为替代值。
		source = "var __t,__p='',__j=Array.prototype.join," +
			"print=function(){__p+=__j.call(arguments,'');};\n" +
			source + 'return __p;\n';

		// var __t, __p = '',
		// 	__j = Array.prototype.join,
		// 	print = function() {
		// 		__p += __j.call(arguments, '');
		// 	};
		// with(obj || {}) {
		// 	__p += 'hello: ' +
		// 		((__t = (name)) == null ? '' : __t) +
		// 		'';
		// }
		// return __p;


		var render;
		try {
			//注意: 使用Function构造器生成的函数，并不会在创建它们的上下文中创建闭包；它们一般在全局作用域中被创建。当运行这些函数的时候，它们只能访问自己的本地变量和全局变量，不能访问Function构造器被调用生成的上下文的作用域。这和使用带有函数表达式代码的 eval 不同。
			//new Function ([arg1[, arg2[, ...argN]],] functionBody)


			render = new Function(settings.variable || 'obj', '_', source);
		} catch (e) {
			e.source = source;
			throw e;
		}

		var template = function(data) {
			return render.call(this, data, _);
		};

		// Provide the compiled source as a convenience for precompilation.
		var argument = settings.variable || 'obj';
		template.source = 'function(' + argument + '){\n' + source + '}';

		return template;
	};


	var compiled = _.template("hello: <%= name %>");
	var res = compiled({
		name: 'moe'
	});
	// console.log(res);


	// var compiled = _.template("hello: <%= name %>",{variable:{name:123}});
	// var res = compiled({name: 'moe'});



	// var template = _.template("<b><%- value %></b>");
	// template({value: '<script>'});

	// var compiled = _.template("<% print('Hello ' + epithet); %>");
	// compiled({epithet: "stooge"});



	// Add a "chain" function. Start chaining a wrapped Underscore object.
	_.chain = function(obj) {

		var instance = _(obj);
		instance._chain = true;
		return instance;
	};

	// OOP
	// ---------------
	// If Underscore is called as a function, it returns a wrapped object that
	// can be used OO-style. This wrapper holds altered versions of all the
	// underscore functions. Wrapped objects may be chained.
	// _作为一个函数来调用。返回一个含有_wrapped对象的对象。可以链式调用。
	// 这个对象包含了所有改变后的_中的方法，这些方法是可以链式调用的。

	// Helper function to continue chaining intermediate results.
	// 助手函数 继续链式 调用的中间结果
	var chainResult = function(instance, obj) {
		//如果是_.chain生成的实例。会有一个参数_.chain = true;
		//这种情况下就返回下一步的中间结果。obj是上一步的结果。生成一个新的
		//_(obj).chain()的效果等同于 _.chain(obj)?
		return instance._chain ? _(obj).chain() : obj;
	};

	// Add your own custom functions to the Underscore object.
	// 把obj里的的方法放到_上。同时也放到_原型上。_原型上的是经过处理过的函数。
	_.mixin = function(obj) {
		_.each(_.functions(obj), function(name) {
			//把obj里的的方法放到_上
			var func = _[name] = obj[name];
			//函数处理后放到原型上
			_.prototype[name] = function() {
				//这里的this指向_的实例
				//args是氢初始参数放到一个数组里。
				var args = [this._wrapped];
				//新的参数也放该数组中
				push.apply(args, arguments);
				//返回中间结果
				return chainResult(this, func.apply(_, args));
			};
		});
		return _;
	};

	// Add all of the Underscore functions to the wrapper object.
	// 把所有的_方法放到_原型上。
	_.mixin(_);

	// Add all mutator Array functions to the wrapper.
	// 把数组原生的方法修改并放到原型上。 这样使这些原生方法也可以链式调用。
	// 这些方法是直接在数组上进行操作的方法。
	_.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
		var method = ArrayProto[name];
		_.prototype[name] = function() {
			var obj = this._wrapped;
			method.apply(obj, arguments);
			//这一行是处理ie下的bug。shift()和splice()在低版本IE时删除不掉类数组对象obj[0]的值。所以这里要特别处理。
			//详见https://github.com/jashkenas/underscore/issues/397
			if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
			//返回链式调用的中间值。
			return chainResult(this, obj);
		};
	});

	// Add all accessor Array functions to the wrapper.
	// 把数组原生的方法放到原型上。
	// 这些不是直接在数组上操作，而是返回一个新的结果。
	_.each(['concat', 'join', 'slice'], function(name) {
		var method = ArrayProto[name];
		_.prototype[name] = function() {
			//会把返回的结果当成新的值传入中间态。_wrapped会等于这个值。
			return chainResult(this, method.apply(this._wrapped, arguments));
		};
	});

	// Extracts the result from a wrapped and chained object.
	// 调用这个函数会从中间态中拿到结果值并结束链式调用。
	_.prototype.value = function() {
		return this._wrapped;
	};

	// Provide unwrapping proxy for some methods used in engine operations
	// such as arithmetic and JSON stringification.
	// 写入_实例的valueOf toJson方法。 返回_wrapped
	_.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

	// 写入_实例的toString方法。 返回_wrapped的string结果。
	_.prototype.toString = function() {
		return String(this._wrapped);
	};

	// AMD registration happens at the end for compatibility with AMD loaders
	// that may not enforce next-turn semantics on modules. Even though general
	// practice for AMD registration is to be anonymous, underscore registers
	// as a named module because, like jQuery, it is a base library that is
	// popular enough to be bundled in a third party lib, but not be part of
	// an AMD load request. Those cases could generate an error when an
	// anonymous define() is called outside of a loader request.
	// 兼容 AMD 规范
	if (typeof define == 'function' && define.amd) {
		define('underscore', [], function() {
			return _;
		});
	}


}());


// _ = exports._;

// var log = function(v) {
// 		console.log(v);
// 	}
// 	// _.each([1, 2, 3], log);
*　使用void 0　代替undefined
	* 在低版本IE中，undefined可以被重写
	* 在es5中，全局对象中的是只读的，但是局部环境是可以重写的。
	* void 后面跟任何值，返回都是undefined。void是保留字不会被重写。
	* void 运算符会对给定的表达式进行求值，然后直接返回 undefined。所以void 0 最短。
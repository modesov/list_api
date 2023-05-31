(function () {
	'use strict';

	const PATH_SEPARATOR = '.';
	const TARGET = Symbol('target');
	const UNSUBSCRIBE = Symbol('unsubscribe');

	function isBuiltinWithMutableMethods(value) {
		return value instanceof Date
			|| value instanceof Set
			|| value instanceof Map
			|| value instanceof WeakSet
			|| value instanceof WeakMap
			|| ArrayBuffer.isView(value);
	}

	function isBuiltinWithoutMutableMethods(value) {
		return (typeof value === 'object' ? value === null : typeof value !== 'function') || value instanceof RegExp;
	}

	var isArray = Array.isArray;

	function isSymbol(value) {
		return typeof value === 'symbol';
	}

	const path = {
		after: (path, subPath) => {
			if (isArray(path)) {
				return path.slice(subPath.length);
			}

			if (subPath === '') {
				return path;
			}

			return path.slice(subPath.length + 1);
		},
		concat: (path, key) => {
			if (isArray(path)) {
				path = [...path];

				if (key) {
					path.push(key);
				}

				return path;
			}

			if (key && key.toString !== undefined) {
				if (path !== '') {
					path += PATH_SEPARATOR;
				}

				if (isSymbol(key)) {
					return path + key.toString();
				}

				return path + key;
			}

			return path;
		},
		initial: path => {
			if (isArray(path)) {
				return path.slice(0, -1);
			}

			if (path === '') {
				return path;
			}

			const index = path.lastIndexOf(PATH_SEPARATOR);

			if (index === -1) {
				return '';
			}

			return path.slice(0, index);
		},
		last: path => {
			if (isArray(path)) {
				return path[path.length - 1] || '';
			}

			if (path === '') {
				return path;
			}

			const index = path.lastIndexOf(PATH_SEPARATOR);

			if (index === -1) {
				return path;
			}

			return path.slice(index + 1);
		},
		walk: (path, callback) => {
			if (isArray(path)) {
				for (const key of path) {
					callback(key);
				}
			} else if (path !== '') {
				let position = 0;
				let index = path.indexOf(PATH_SEPARATOR);

				if (index === -1) {
					callback(path);
				} else {
					while (position < path.length) {
						if (index === -1) {
							index = path.length;
						}

						callback(path.slice(position, index));

						position = index + 1;
						index = path.indexOf(PATH_SEPARATOR, position);
					}
				}
			}
		},
		get(object, path) {
			this.walk(path, key => {
				if (object) {
					object = object[key];
				}
			});

			return object;
		},
	};

	function isIterator(value) {
		return typeof value === 'object' && typeof value.next === 'function';
	}

	// eslint-disable-next-line max-params
	function wrapIterator(iterator, target, thisArg, applyPath, prepareValue) {
		const originalNext = iterator.next;

		if (target.name === 'entries') {
			iterator.next = function () {
				const result = originalNext.call(this);

				if (result.done === false) {
					result.value[0] = prepareValue(
						result.value[0],
						target,
						result.value[0],
						applyPath,
					);
					result.value[1] = prepareValue(
						result.value[1],
						target,
						result.value[0],
						applyPath,
					);
				}

				return result;
			};
		} else if (target.name === 'values') {
			const keyIterator = thisArg[TARGET].keys();

			iterator.next = function () {
				const result = originalNext.call(this);

				if (result.done === false) {
					result.value = prepareValue(
						result.value,
						target,
						keyIterator.next().value,
						applyPath,
					);
				}

				return result;
			};
		} else {
			iterator.next = function () {
				const result = originalNext.call(this);

				if (result.done === false) {
					result.value = prepareValue(
						result.value,
						target,
						result.value,
						applyPath,
					);
				}

				return result;
			};
		}

		return iterator;
	}

	function ignoreProperty(cache, options, property) {
		return cache.isUnsubscribed
			|| (options.ignoreSymbols && isSymbol(property))
			|| (options.ignoreUnderscores && property.charAt(0) === '_')
			|| ('ignoreKeys' in options && options.ignoreKeys.includes(property));
	}

	/**
	@class Cache
	@private
	*/
	class Cache {
		constructor(equals) {
			this._equals = equals;
			this._proxyCache = new WeakMap();
			this._pathCache = new WeakMap();
			this.isUnsubscribed = false;
		}

		_getDescriptorCache() {
			if (this._descriptorCache === undefined) {
				this._descriptorCache = new WeakMap();
			}

			return this._descriptorCache;
		}

		_getProperties(target) {
			const descriptorCache = this._getDescriptorCache();
			let properties = descriptorCache.get(target);

			if (properties === undefined) {
				properties = {};
				descriptorCache.set(target, properties);
			}

			return properties;
		}

		_getOwnPropertyDescriptor(target, property) {
			if (this.isUnsubscribed) {
				return Reflect.getOwnPropertyDescriptor(target, property);
			}

			const properties = this._getProperties(target);
			let descriptor = properties[property];

			if (descriptor === undefined) {
				descriptor = Reflect.getOwnPropertyDescriptor(target, property);
				properties[property] = descriptor;
			}

			return descriptor;
		}

		getProxy(target, path, handler, proxyTarget) {
			if (this.isUnsubscribed) {
				return target;
			}

			const reflectTarget = target[proxyTarget];
			const source = reflectTarget || target;

			this._pathCache.set(source, path);

			let proxy = this._proxyCache.get(source);

			if (proxy === undefined) {
				proxy = reflectTarget === undefined
					? new Proxy(target, handler)
					: target;

				this._proxyCache.set(source, proxy);
			}

			return proxy;
		}

		getPath(target) {
			return this.isUnsubscribed ? undefined : this._pathCache.get(target);
		}

		isDetached(target, object) {
			return !Object.is(target, path.get(object, this.getPath(target)));
		}

		defineProperty(target, property, descriptor) {
			if (!Reflect.defineProperty(target, property, descriptor)) {
				return false;
			}

			if (!this.isUnsubscribed) {
				this._getProperties(target)[property] = descriptor;
			}

			return true;
		}

		setProperty(target, property, value, receiver, previous) { // eslint-disable-line max-params
			if (!this._equals(previous, value) || !(property in target)) {
				const descriptor = this._getOwnPropertyDescriptor(target, property);

				if (descriptor !== undefined && 'set' in descriptor) {
					return Reflect.set(target, property, value, receiver);
				}

				return Reflect.set(target, property, value);
			}

			return true;
		}

		deleteProperty(target, property, previous) {
			if (Reflect.deleteProperty(target, property)) {
				if (!this.isUnsubscribed) {
					const properties = this._getDescriptorCache().get(target);

					if (properties) {
						delete properties[property];
						this._pathCache.delete(previous);
					}
				}

				return true;
			}

			return false;
		}

		isSameDescriptor(a, target, property) {
			const b = this._getOwnPropertyDescriptor(target, property);

			return a !== undefined
				&& b !== undefined
				&& Object.is(a.value, b.value)
				&& (a.writable || false) === (b.writable || false)
				&& (a.enumerable || false) === (b.enumerable || false)
				&& (a.configurable || false) === (b.configurable || false)
				&& a.get === b.get
				&& a.set === b.set;
		}

		isGetInvariant(target, property) {
			const descriptor = this._getOwnPropertyDescriptor(target, property);

			return descriptor !== undefined
				&& descriptor.configurable !== true
				&& descriptor.writable !== true;
		}

		unsubscribe() {
			this._descriptorCache = null;
			this._pathCache = null;
			this._proxyCache = null;
			this.isUnsubscribed = true;
		}
	}

	function isObject(value) {
		return toString.call(value) === '[object Object]';
	}

	function isDiffCertain() {
		return true;
	}

	function isDiffArrays(clone, value) {
		return clone.length !== value.length || clone.some((item, index) => value[index] !== item);
	}

	const IMMUTABLE_OBJECT_METHODS = new Set([
		'hasOwnProperty',
		'isPrototypeOf',
		'propertyIsEnumerable',
		'toLocaleString',
		'toString',
		'valueOf',
	]);

	const IMMUTABLE_ARRAY_METHODS = new Set([
		'concat',
		'includes',
		'indexOf',
		'join',
		'keys',
		'lastIndexOf',
	]);

	const MUTABLE_ARRAY_METHODS = {
		push: isDiffCertain,
		pop: isDiffCertain,
		shift: isDiffCertain,
		unshift: isDiffCertain,
		copyWithin: isDiffArrays,
		reverse: isDiffArrays,
		sort: isDiffArrays,
		splice: isDiffArrays,
		flat: isDiffArrays,
		fill: isDiffArrays,
	};

	const HANDLED_ARRAY_METHODS = new Set([
		...IMMUTABLE_OBJECT_METHODS,
		...IMMUTABLE_ARRAY_METHODS,
		...Object.keys(MUTABLE_ARRAY_METHODS),
	]);

	function isDiffSets(clone, value) {
		if (clone.size !== value.size) {
			return true;
		}

		for (const element of clone) {
			if (!value.has(element)) {
				return true;
			}
		}

		return false;
	}

	const COLLECTION_ITERATOR_METHODS = [
		'keys',
		'values',
		'entries',
	];

	const IMMUTABLE_SET_METHODS = new Set([
		'has',
		'toString',
	]);

	const MUTABLE_SET_METHODS = {
		add: isDiffSets,
		clear: isDiffSets,
		delete: isDiffSets,
		forEach: isDiffSets,
	};

	const HANDLED_SET_METHODS = new Set([
		...IMMUTABLE_SET_METHODS,
		...Object.keys(MUTABLE_SET_METHODS),
		...COLLECTION_ITERATOR_METHODS,
	]);

	function isDiffMaps(clone, value) {
		if (clone.size !== value.size) {
			return true;
		}

		let bValue;
		for (const [key, aValue] of clone) {
			bValue = value.get(key);

			if (bValue !== aValue || (bValue === undefined && !value.has(key))) {
				return true;
			}
		}

		return false;
	}

	const IMMUTABLE_MAP_METHODS = new Set([...IMMUTABLE_SET_METHODS, 'get']);

	const MUTABLE_MAP_METHODS = {
		set: isDiffMaps,
		clear: isDiffMaps,
		delete: isDiffMaps,
		forEach: isDiffMaps,
	};

	const HANDLED_MAP_METHODS = new Set([
		...IMMUTABLE_MAP_METHODS,
		...Object.keys(MUTABLE_MAP_METHODS),
		...COLLECTION_ITERATOR_METHODS,
	]);

	class CloneObject {
		constructor(value, path, argumentsList, hasOnValidate) {
			this._path = path;
			this._isChanged = false;
			this._clonedCache = new Set();
			this._hasOnValidate = hasOnValidate;
			this._changes = hasOnValidate ? [] : null;

			this.clone = path === undefined ? value : this._shallowClone(value);
		}

		static isHandledMethod(name) {
			return IMMUTABLE_OBJECT_METHODS.has(name);
		}

		_shallowClone(value) {
			let clone = value;

			if (isObject(value)) {
				clone = {...value};
			} else if (isArray(value) || ArrayBuffer.isView(value)) {
				clone = [...value];
			} else if (value instanceof Date) {
				clone = new Date(value);
			} else if (value instanceof Set) {
				clone = new Set([...value].map(item => this._shallowClone(item)));
			} else if (value instanceof Map) {
				clone = new Map();

				for (const [key, item] of value.entries()) {
					clone.set(key, this._shallowClone(item));
				}
			}

			this._clonedCache.add(clone);

			return clone;
		}

		preferredThisArg(isHandledMethod, name, thisArg, thisProxyTarget) {
			if (isHandledMethod) {
				if (isArray(thisProxyTarget)) {
					this._onIsChanged = MUTABLE_ARRAY_METHODS[name];
				} else if (thisProxyTarget instanceof Set) {
					this._onIsChanged = MUTABLE_SET_METHODS[name];
				} else if (thisProxyTarget instanceof Map) {
					this._onIsChanged = MUTABLE_MAP_METHODS[name];
				}

				return thisProxyTarget;
			}

			return thisArg;
		}

		update(fullPath, property, value) {
			const changePath = path.after(fullPath, this._path);

			if (property !== 'length') {
				let object = this.clone;

				path.walk(changePath, key => {
					if (object && object[key]) {
						if (!this._clonedCache.has(object[key])) {
							object[key] = this._shallowClone(object[key]);
						}

						object = object[key];
					}
				});

				if (this._hasOnValidate) {
					this._changes.push({
						path: changePath,
						property,
						previous: value,
					});
				}

				if (object && object[property]) {
					object[property] = value;
				}
			}

			this._isChanged = true;
		}

		undo(object) {
			let change;

			for (let index = this._changes.length - 1; index !== -1; index--) {
				change = this._changes[index];

				path.get(object, change.path)[change.property] = change.previous;
			}
		}

		isChanged(value) {
			return this._onIsChanged === undefined
				? this._isChanged
				: this._onIsChanged(this.clone, value);
		}
	}

	class CloneArray extends CloneObject {
		static isHandledMethod(name) {
			return HANDLED_ARRAY_METHODS.has(name);
		}
	}

	class CloneDate extends CloneObject {
		undo(object) {
			object.setTime(this.clone.getTime());
		}

		isChanged(value, equals) {
			return !equals(this.clone.valueOf(), value.valueOf());
		}
	}

	class CloneSet extends CloneObject {
		static isHandledMethod(name) {
			return HANDLED_SET_METHODS.has(name);
		}

		undo(object) {
			for (const value of this.clone) {
				object.add(value);
			}

			for (const value of object) {
				if (!this.clone.has(value)) {
					object.delete(value);
				}
			}
		}
	}

	class CloneMap extends CloneObject {
		static isHandledMethod(name) {
			return HANDLED_MAP_METHODS.has(name);
		}

		undo(object) {
			for (const [key, value] of this.clone.entries()) {
				object.set(key, value);
			}

			for (const key of object.keys()) {
				if (!this.clone.has(key)) {
					object.delete(key);
				}
			}
		}
	}

	class CloneWeakSet extends CloneObject {
		constructor(value, path, argumentsList, hasOnValidate) {
			super(undefined, path, argumentsList, hasOnValidate);

			this._arg1 = argumentsList[0];
			this._weakValue = value.has(this._arg1);
		}

		isChanged(value) {
			return this._weakValue !== value.has(this._arg1);
		}

		undo(object) {
			if (this._weakValue && !object.has(this._arg1)) {
				object.add(this._arg1);
			} else {
				object.delete(this._arg1);
			}
		}
	}

	class CloneWeakMap extends CloneObject {
		constructor(value, path, argumentsList, hasOnValidate) {
			super(undefined, path, argumentsList, hasOnValidate);

			this._weakKey = argumentsList[0];
			this._weakHas = value.has(this._weakKey);
			this._weakValue = value.get(this._weakKey);
		}

		isChanged(value) {
			return this._weakValue !== value.get(this._weakKey);
		}

		undo(object) {
			const weakHas = object.has(this._weakKey);

			if (this._weakHas && !weakHas) {
				object.set(this._weakKey, this._weakValue);
			} else if (!this._weakHas && weakHas) {
				object.delete(this._weakKey);
			} else if (this._weakValue !== object.get(this._weakKey)) {
				object.set(this._weakKey, this._weakValue);
			}
		}
	}

	class SmartClone {
		constructor(hasOnValidate) {
			this._stack = [];
			this._hasOnValidate = hasOnValidate;
		}

		static isHandledType(value) {
			return isObject(value)
				|| isArray(value)
				|| isBuiltinWithMutableMethods(value);
		}

		static isHandledMethod(target, name) {
			if (isObject(target)) {
				return CloneObject.isHandledMethod(name);
			}

			if (isArray(target)) {
				return CloneArray.isHandledMethod(name);
			}

			if (target instanceof Set) {
				return CloneSet.isHandledMethod(name);
			}

			if (target instanceof Map) {
				return CloneMap.isHandledMethod(name);
			}

			return isBuiltinWithMutableMethods(target);
		}

		get isCloning() {
			return this._stack.length > 0;
		}

		start(value, path, argumentsList) {
			let CloneClass = CloneObject;

			if (isArray(value)) {
				CloneClass = CloneArray;
			} else if (value instanceof Date) {
				CloneClass = CloneDate;
			} else if (value instanceof Set) {
				CloneClass = CloneSet;
			} else if (value instanceof Map) {
				CloneClass = CloneMap;
			} else if (value instanceof WeakSet) {
				CloneClass = CloneWeakSet;
			} else if (value instanceof WeakMap) {
				CloneClass = CloneWeakMap;
			}

			this._stack.push(new CloneClass(value, path, argumentsList, this._hasOnValidate));
		}

		update(fullPath, property, value) {
			this._stack[this._stack.length - 1].update(fullPath, property, value);
		}

		preferredThisArg(target, thisArg, thisProxyTarget) {
			const {name} = target;
			const isHandledMethod = SmartClone.isHandledMethod(thisProxyTarget, name);

			return this._stack[this._stack.length - 1]
				.preferredThisArg(isHandledMethod, name, thisArg, thisProxyTarget);
		}

		isChanged(isMutable, value, equals) {
			return this._stack[this._stack.length - 1].isChanged(isMutable, value, equals);
		}

		undo(object) {
			if (this._previousClone !== undefined) {
				this._previousClone.undo(object);
			}
		}

		stop() {
			this._previousClone = this._stack.pop();

			return this._previousClone.clone;
		}
	}

	/* eslint-disable unicorn/prefer-spread */

	const defaultOptions = {
		equals: Object.is,
		isShallow: false,
		pathAsArray: false,
		ignoreSymbols: false,
		ignoreUnderscores: false,
		ignoreDetached: false,
		details: false,
	};

	const onChange = (object, onChange, options = {}) => {
		options = {
			...defaultOptions,
			...options,
		};

		const proxyTarget = Symbol('ProxyTarget');
		const {equals, isShallow, ignoreDetached, details} = options;
		const cache = new Cache(equals);
		const hasOnValidate = typeof options.onValidate === 'function';
		const smartClone = new SmartClone(hasOnValidate);

		// eslint-disable-next-line max-params
		const validate = (target, property, value, previous, applyData) => !hasOnValidate
			|| smartClone.isCloning
			|| options.onValidate(path.concat(cache.getPath(target), property), value, previous, applyData) === true;

		const handleChangeOnTarget = (target, property, value, previous) => {
			if (
				!ignoreProperty(cache, options, property)
				&& !(ignoreDetached && cache.isDetached(target, object))
			) {
				handleChange(cache.getPath(target), property, value, previous);
			}
		};

		// eslint-disable-next-line max-params
		const handleChange = (changePath, property, value, previous, applyData) => {
			if (smartClone.isCloning) {
				smartClone.update(changePath, property, previous);
			} else {
				onChange(path.concat(changePath, property), value, previous, applyData);
			}
		};

		const getProxyTarget = value => value
			? (value[proxyTarget] || value)
			: value;

		const prepareValue = (value, target, property, basePath) => {
			if (
				isBuiltinWithoutMutableMethods(value)
				|| property === 'constructor'
				|| (isShallow && !SmartClone.isHandledMethod(target, property))
				|| ignoreProperty(cache, options, property)
				|| cache.isGetInvariant(target, property)
				|| (ignoreDetached && cache.isDetached(target, object))
			) {
				return value;
			}

			if (basePath === undefined) {
				basePath = cache.getPath(target);
			}

			return cache.getProxy(value, path.concat(basePath, property), handler, proxyTarget);
		};

		const handler = {
			get(target, property, receiver) {
				if (isSymbol(property)) {
					if (property === proxyTarget || property === TARGET) {
						return target;
					}

					if (
						property === UNSUBSCRIBE
						&& !cache.isUnsubscribed
						&& cache.getPath(target).length === 0
					) {
						cache.unsubscribe();
						return target;
					}
				}

				const value = isBuiltinWithMutableMethods(target)
					? Reflect.get(target, property)
					: Reflect.get(target, property, receiver);

				return prepareValue(value, target, property);
			},

			set(target, property, value, receiver) {
				value = getProxyTarget(value);

				const reflectTarget = target[proxyTarget] || target;
				const previous = reflectTarget[property];

				if (equals(previous, value) && property in target) {
					return true;
				}

				const isValid = validate(target, property, value, previous);

				if (
					isValid
					&& cache.setProperty(reflectTarget, property, value, receiver, previous)
				) {
					handleChangeOnTarget(target, property, target[property], previous);

					return true;
				}

				return !isValid;
			},

			defineProperty(target, property, descriptor) {
				if (!cache.isSameDescriptor(descriptor, target, property)) {
					const previous = target[property];

					if (
						validate(target, property, descriptor.value, previous)
						&& cache.defineProperty(target, property, descriptor, previous)
					) {
						handleChangeOnTarget(target, property, descriptor.value, previous);
					}
				}

				return true;
			},

			deleteProperty(target, property) {
				if (!Reflect.has(target, property)) {
					return true;
				}

				const previous = Reflect.get(target, property);
				const isValid = validate(target, property, undefined, previous);

				if (
					isValid
					&& cache.deleteProperty(target, property, previous)
				) {
					handleChangeOnTarget(target, property, undefined, previous);

					return true;
				}

				return !isValid;
			},

			apply(target, thisArg, argumentsList) {
				const thisProxyTarget = thisArg[proxyTarget] || thisArg;

				if (cache.isUnsubscribed) {
					return Reflect.apply(target, thisProxyTarget, argumentsList);
				}

				if (
					(details === false
						|| (details !== true && !details.includes(target.name)))
					&& SmartClone.isHandledType(thisProxyTarget)
				) {
					let applyPath = path.initial(cache.getPath(target));
					const isHandledMethod = SmartClone.isHandledMethod(thisProxyTarget, target.name);

					smartClone.start(thisProxyTarget, applyPath, argumentsList);

					let result = Reflect.apply(
						target,
						smartClone.preferredThisArg(target, thisArg, thisProxyTarget),
						isHandledMethod
							? argumentsList.map(argument => getProxyTarget(argument))
							: argumentsList,
					);

					const isChanged = smartClone.isChanged(thisProxyTarget, equals);
					const previous = smartClone.stop();

					if (SmartClone.isHandledType(result) && isHandledMethod) {
						if (thisArg instanceof Map && target.name === 'get') {
							applyPath = path.concat(applyPath, argumentsList[0]);
						}

						result = cache.getProxy(result, applyPath, handler);
					}

					if (isChanged) {
						const applyData = {
							name: target.name,
							args: argumentsList,
							result,
						};
						const changePath = smartClone.isCloning
							? path.initial(applyPath)
							: applyPath;
						const property = smartClone.isCloning
							? path.last(applyPath)
							: '';

						if (validate(path.get(object, changePath), property, thisProxyTarget, previous, applyData)) {
							handleChange(changePath, property, thisProxyTarget, previous, applyData);
						} else {
							smartClone.undo(thisProxyTarget);
						}
					}

					if (
						(thisArg instanceof Map || thisArg instanceof Set)
						&& isIterator(result)
					) {
						return wrapIterator(result, target, thisArg, applyPath, prepareValue);
					}

					return result;
				}

				return Reflect.apply(target, thisArg, argumentsList);
			},
		};

		const proxy = cache.getProxy(object, options.pathAsArray ? [] : '', handler);
		onChange = onChange.bind(proxy);

		if (hasOnValidate) {
			options.onValidate = options.onValidate.bind(proxy);
		}

		return proxy;
	};

	onChange.target = proxy => (proxy && proxy[TARGET]) || proxy;
	onChange.unsubscribe = proxy => proxy[UNSUBSCRIBE] || proxy;

	class BaseComponent {
	  constructor(tagName, className = null) {
	    this.el = document.createElement(tagName);
	    
	    if (className) {
	      this.el.classList.add(className);
	    }
	  }

	  render() {
	    return this.renderTemplate();
	  }

	  renderTemplate(html = '') {
	    this.el.innerHTML = html;
	    return this.el;
	  }
	}

	var headerHtml = (_) => `<div class="header__container container">
  <div class="header__logo"><a class="header__link" href="/">Сборник RESTful API</a></div>
<div></div></div>`;

	class Header extends BaseComponent {
	  constructor(appState) {
	    super('header', 'header');
	    this.appState = appState;
	  }

	  render() {
	    return this.renderTemplate(headerHtml());
	  }
	}

	var footerHtml = (_) => `<div class="footer__container container">
  <div class="footer__copyright">© Сборник RESTful API 2023 год</div>
</div>`;

	class Footer extends BaseComponent {
	  constructor(appState) {
	    super('footer', 'footer');
	    this.appState = appState;
	  }

	  render() {
	    return this.renderTemplate(footerHtml())
	  }
	}

	var sidebarHtml = (_) => `<div class="sidebar__categories">
  <div class="sidebar__header">Категории</div>
  <ul class="sidebar__list">

  </ul>
</div>`;

	var loadingHtml = (_) => `<div class="loading__text">
  Загрузка...
</div>`;

	class Loading extends BaseComponent {
	  constructor() {
	    super('div', 'loading');
	  }
	  
	  render() {
	      return this.renderTemplate(loadingHtml());
	  }
	}

	var itemCategoryHtml = (_) => `<button class="item-category__btn">${ _.name }</button>`;

	class ItemCategory extends BaseComponent {
	  constructor(name, isActive = false) {
	    super('li', 'item-category');
	    if (isActive) {
	      this.el.classList.add('item-category__active');
	    }
	    this.name = name;
	  }

	  render() {
	    return this.renderTemplate(itemCategoryHtml({name: this.name}));
	  }
	}

	const updateURL = (params) => {
	  const currentParams = getParams();

	  for(let param in params) {
	    currentParams[param] = params[param];
	  }  

	  const paramsStr = paramsToString(currentParams);
	  
	  if (history.pushState) {
	      const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
	      const newUrl = `${baseUrl}${paramsStr}`;
	      history.pushState(null, null, newUrl);
	  }
	  else {
	      console.warn('History API не поддерживается');
	  }
	};

	const paramsToString = (params, allowed = []) => {
	  const arFullParams = [];
	  for(let param in params) {
	    if (allowed.length && !allowed.includes(param) || !params[param]) {
	      continue;
	    }

	    arFullParams.push(`${param}=${params[param]}`);
	  }

	  return arFullParams.length ? `?${arFullParams.join('&')}` : '';
	};

	const getParams = () => {
	  const result = {};

	  getParamsStr().split('&').forEach(el => {
	    const arParam = el.split('=');
	    
	    result[arParam[0]] = arParam[1];
	  });

	  return result;
	}; 

	const getParamsStr = () => {
	  return window.location.search.slice(1);
	};

	const translate = async (str) => {
	  const result = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&hl=ru&dt=t&dt=bd&dj=1&source=icon&tk=835045.835045&q=${encodeURI(str)}`);
	  return result.json();
	};

	class Sidebar extends BaseComponent {
	  state = {
	    loading: false,
	    categories: []
	  }

	  constructor(appState) {
	    super('aside', 'sidebar');
	    this.state = onChange(this.state, this.stateHook.bind(this));
	    this.appState = appState;
	    this.loadDataCategories();
	  }

	  async loadDataCategories() {
	    this.state.loading = true;
	    const categories = await this.loadCategories();
	    this.state.loading = false;
	    this.state.categories = categories.categories;
	  }

	  async loadCategories() {
	    const result = await fetch('https://api.publicapis.org/categories');
	    return result.json();
	  }

	  stateHook(path) {
	    if (path === 'categories') {
	      if (this.state.categories.length) {
	        let category = getParams().category;

	        if (category) {
	          category = decodeURI(category.trim());
	          const currentCategory = this.state.categories.find(el => el.toLowerCase().includes(category));
	          this.appState.currentCategory = currentCategory ? currentCategory : null;
	        } else {
	          this.appState.currentCategory = null;
	        }
	      }

	      this.render();
	    }    
	  }

	  categoryHandler(event) {
	    const el = event.target;
	    if (el.classList.contains('item-category__btn')) {
	      const category = el.innerText !== 'All' ? el.innerText : null;
	      const params = {category: category?.split(' &')[0].toLowerCase(), page: null};
	      updateURL(params);

	      this.appState.currentCategory = category;
	      this.appState.currentPage = 1;
	    }
	  }

	  render() {
	    if (this.state.loading) {
	      this.el.innerHTML = '';
	      this.el.append((new Loading).render());
	      return this.el;
	    }

	    this.renderTemplate(sidebarHtml());
	    const categoryList = this.el.querySelector('.sidebar__list');

	    categoryList.append((new ItemCategory('All', !this.appState.currentCategory)).render());
	    
	    for(const category of this.state.categories) {
	      categoryList.append((new ItemCategory(category, this.appState.currentCategory === category)).render());
	    }

	    categoryList.addEventListener('click', this.categoryHandler.bind(this));

	    return this.el;
	  }
	}

	class AbstractView {
	  constructor(appState, title) {
	    this.app = document.getElementById('root');
	    this.appState = appState;
	    this.appState = onChange(this.appState, this.appStateHook.bind(this));
	    this.header = this.getHeader();
	    this.sidebar = this.getSidebar();
	    this.footer = this.getFooter();
	    this.setTitle(title);
	  }

	  appStateHook() {
	    this.render();
	  }

	  setTitle(title) {
	    document.title = title;
	  }

	  createEl() {
	    return null;
	  }

	  render() {
	    this.app.innerHTML = '';

	    const wrapperBox = document.createElement('div');
	    wrapperBox.classList.add('wrapper-box');

	    if (this.header) {
	      wrapperBox.append(this.header.render());
	    }

	    if (this.sidebar) {
	      wrapperBox.append(this.sidebar.render());
	    }    

	    wrapperBox.append(this.createEl());
	    
	    if (this.footer) {
	      wrapperBox.append(this.footer.render());
	    }

	    this.app.append(wrapperBox);
	  }

	  getHeader() {
	    return new Header(this.appState);
	  }

	  getFooter() {
	    return new Footer(this.appState);
	  }

	  getSidebar() {
	    return new Sidebar(this.appState);
	  }

	  destroy() {
	    return;
	  }
	}

	const LIMIT_PER_PAGE = 4;

	var CardApiHtml = (_) => `<div class="card-api__index">${ _.index }</div>
<div class="card-api__name">${ _.API }</div>
<div class="card-api__category"><span class="card-api__th">Category:</span>${ _.Category }</div>
<div class="card-api__description"><span class="card-api__th">En:</span>${ _.Description }</div>
<div class="card-api__description"><span class="card-api__th">Ru:</span>${ _.DescriptionRu }</div>
<hr class="card-api__hr">
<div class="card-api__link"><a target="_blank" href="${ _.Link }">Документация</a></div>
<div class="card-api__auth"><span class="card-api__th">Авторизация:</span>${ _.Auth }</div>
<div class="card-api__cors"><span class="card-api__th">Cors:</span>${ _.Cors }</div>
<div class="card-api__https"><span class="card-api__th">HTTPS:</span>${ _.HTTPS }</div>`;

	class CardApi extends BaseComponent {
	  constructor(item, index) {
	    super('li', 'card-api');
	    this.item = { ...item, index: index };

	    this.item.HTTPS = this.item.HTTPS ? 'yes' : 'no'; 
	    this.item.Auth = this.item.Auth ? this.item.Auth : 'no'; 
	  }

	  render() {
	    return this.renderTemplate(CardApiHtml({ ...this.item }));
	  }
	}

	class ListApis extends BaseComponent {
	  constructor(appState, parentState) {
	    super('div', 'list-apis');
	    this.appState = appState;
	    this.parentState = parentState;
	    this.items = [];
	  }

	  async trans(item) {
	    if (item.DescriptionRu) {
	      return;
	    }

	    return await translate(item.Description);
	  }

	  render() {
	    if (this.parentState.loading) {
	      this.el.append((new Loading).render());
	      return this.el;
	    }

	    const header = document.createElement('h1');
	    header.innerText = this.appState.currentCategory ? `Api категории ${this.appState.currentCategory}` : 'Все api';
	    this.el.append(header);

	    const listElements = document.createElement('ul');
	    listElements.classList.add('list-apis__list');
	    
	    if (!this.items.length) {
	      const items = this.parentState.list?.slice(this.parentState.offset, this.parentState.offset + LIMIT_PER_PAGE);
	      this.items = items ? items : [];
	    }

	    let i = 1 + this.parentState.offset;
	    for(const item of this.items) {
	      this.trans(item).then(data => {
	        if (data?.sentences[0]?.trans) {
	          item.DescriptionRu = data.sentences[0].trans;
	        }
	  
	        listElements?.append((new CardApi(item, i)).render());
	        i++;
	      });      
	    }

	    this.el.append(listElements);
	    return this.el;
	  }
	}

	var itemPaginationHtml = (_) => `<button class="item-pagination__btn" data-id="${ _.id }">${ _.name }</button>`;

	class ItemPagination extends BaseComponent {
	  constructor(id, name, isActive = false) {
	    super('li', 'item-pagination');
	    if (isActive) {
	      this.el.classList.add('item-pagination__active');
	    }
	    this.name = name;
	    this.id = id;
	  }

	  render() {
	    return this.renderTemplate(itemPaginationHtml({ name: this.name, id: this.id }))
	  }
	}

	class Pagination extends BaseComponent {
	  constructor(appState, parentState) {
	    super('ul', 'pagination');
	    this.appState = appState;
	    this.parentState = parentState;
	  }

	  nextHandler() {
	    const newOffset = this.parentState.offset + LIMIT_PER_PAGE;
	    if (newOffset < this.parentState.count) {
	      this.parentState.offset = newOffset;
	    }
	  }

	  previousHandler() {
	    let newOffset = this.parentState.offset - LIMIT_PER_PAGE;

	    if (newOffset < 0) {
	      newOffset = 0;
	    }

	    this.parentState.offset = newOffset;
	  }

	  paginationHandler(event) {
	    const el = event.target;
	    if (el.classList.contains('item-pagination__btn')) {
	      const id = el.dataset.id;

	      if (!isNaN(id)) {
	        this.parentState.offset = (+id -1) * LIMIT_PER_PAGE;
	      } else if (id === 'next') {
	        this.nextHandler();
	      } else if (id === 'previous') {
	        this.previousHandler();
	      }

	      const page = (this.parentState.offset / LIMIT_PER_PAGE) + 1;

	      updateURL({page: page > 1 ? page : null});

	      this.appState.currentPage = page;
	    }    
	  }

	  render() {
	    this.el.append((new ItemPagination('next', '>>')).render());

	    const countPage = Math.ceil(this.parentState.count / LIMIT_PER_PAGE);
	    
	    for (let i = 1; i <= countPage; i++ ) {
	      this.el.append((new ItemPagination(i, i, this.appState.currentPage === i)).render());
	    }

	    this.el.append((new ItemPagination('previous', '<<')).render());

	    this.el.addEventListener('click', this.paginationHandler.bind(this));
	    
	    return this.el;
	  }
	}

	var FilterHtml = (_) => `<div class="filter__header">Фильтр</div>
<form class="filter__form" action="">
  <select class="filter__select" name="auth" id="auth_select">
    <option value="">All auth</option>
    <option value="OAuth">OAuth</option>
    <option value="User-Agent">User-Agent</option>
    <option value="X-Mashape-Key">X-Mashape-Key</option>
    <option value="apiKey">apiKey</option>
    <option value="null">no</option>
  </select>
  <select class="filter__select" name="cors" id="cors_select">
    <option value="">All cors</option>
    <option value="no">No</option>
    <option value="yes">Yes</option>
    <option value="unknown">Unknown</option>
    <option value="unkown">Other</option>
  </select>
  <select class="filter__select" name="https" id="https_select">
    <option value="">All http</option>
    <option value="false">No</option>
    <option value="true">Yes</option>
  </select>
</form>`;

	class Filter extends BaseComponent {
	  constructor(parentState) {
	    super('div', 'filter');
	    this.parentState = parentState;
	  }  

	  handleFilter(event) {
	    this.parentState.filter[event.target.name] = event.target.value;
	  }

	  render() {
	    this.renderTemplate(FilterHtml());

	    const selectedAuth = this.parentState.filter.auth;
	    const selectedCors = this.parentState.filter.cors;
	    const selectedHttps = this.parentState.filter.https;

	    if (selectedAuth) {
	      const elAuth = this.el.querySelector(`#auth_select option[value=${selectedAuth}]`);
	      if (elAuth) {
	        elAuth.selected = true;
	      }
	    }
	    
	    if (selectedCors) {
	      const elCors = this.el.querySelector(`#cors_select option[value=${selectedCors}]`);

	      if (elCors) {
	        elCors.selected = true;
	      }
	    }

	    if (selectedHttps) {
	      const elHttps = this.el.querySelector(`#https_select option[value=${selectedHttps}]`);
	      
	      if (elHttps) {
	        elHttps.selected = true;
	      }
	    }

	    
	    this.el.querySelector('.filter__form').addEventListener('input', this.handleFilter.bind(this));
	    return this.el;
	  }
	}

	class MainView extends AbstractView {
	  state = {
	    list: [],
	    loading: false,
	    offset:  0,
	    count: 0,
	    filter: {}
	  };

	  constructor(appState) {
	    super(appState, 'Список api');
	    const params = getParams();
	    if (params.auth) {
	      this.state.filter.auth = params.auth;
	    }

	    if (params.cors) {
	      this.state.filter.cors = params.cors;
	    }

	    if (params.https) {
	      this.state.filter.https = params.https;
	    }
	    
	    this.state = onChange(this.state, this.stateHook.bind(this));
	    this.loadDataApis();
	  }

	  async loadDataApis() {
	    this.state.loading = true;
	    const data = await this.loadListApis();
	    this.state.loading = false;
	    this.state.count = data.count;
	    this.state.list = data.entries;
	    
	    let page = getParams().page;
	    if (page <= 1) {
	      updateURL({page: null});
	      page = 1;
	    }
	    const countPage = Math.ceil(this.state.count / LIMIT_PER_PAGE);
	    if (page > countPage) {
	      page = countPage;
	      updateURL({page: page});
	    }

	    this.appState.currentPage = page ? Number(page) : 1;
	  }

	  async loadListApis() {
	    const param = paramsToString(getParams(), ['title', 'description', 'auth', 'https', 'cors', 'category']);
	    const result = await fetch(`https://api.publicapis.org/entries${param}`);
	    return result.json();
	  }

	  appStateHook(path) {
	    if (path === 'currentCategory') {
	      this.loadDataApis();
	    }

	    if (path === 'currentPage') {
	      this.state.offset = this.appState.currentPage ? (this.appState.currentPage - 1) * LIMIT_PER_PAGE : 0;
	    }
	    
	    this.render();
	  }

	  stateHook(path) {
	    if(path.includes('filter.')) {
	      updateURL(this.state.filter);
	      this.loadDataApis();
	    }
	    
	    if (['list', 'offset', 'filter'].includes(path)) {
	      this.render();
	    }    
	  }

	  createEl() {
	    const main = document.createElement('main');
	    main.classList.add('mainContainer');
	    main.append((new Filter(this.state)).render());
	    main.append((new ListApis(this.appState, this.state)).render());
	    if (this.state.count > LIMIT_PER_PAGE && !this.state.loading) {
	      main.append((new Pagination(this.appState, this.state)).render());
	    }
	    return main;    
	  }
	}

	class App {
	  #routes = [
	    { path: '', view: MainView }
	  ]

	  appState = {
	    favorites: [],
	    currentCategory: null,
	    currentPage: 1
	  };

	  constructor() {
	    document.addEventListener('hashchange', this.route.bind(this));
	    this.route();
	  }

	  route() {
	    // console.log(this); //убрать bind в конструкторе и проверить контекст при hashchange
	    if (this.currentView) {
	      this.currentView.destroy();
	    }

	    const view = this.#routes.find(route => route.path === location.hash).view;
	    this.currentView = new view(this.appState);
	    this.currentView.render();
	  }

	}

	new App();

})();

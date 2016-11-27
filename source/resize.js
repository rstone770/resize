; (function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.resize = factory();
  }
} (this, function () {

  /**
   * Default function debounce period.
   * 
   * @type {number}
   */
  var DEBOUNCE_PERIOD = 1000/60; // 60fps

  /**
   * Debounces some function so that its called at most ever 'wait' ms.
   * 
   * @param {function} fn
   * @param {wait} wait
   * @returns {function}
   */
  var debounce = function (fn, wait) {
    var timeoutHandle = null, called = 0;

    if (wait == 0) {
      return fn;
    }

    return function () {
      var currentArguments = arguments;

      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle);
      }

      timeoutHandle = setTimeout(function() {
        fn.apply(null, currentArguments);
      }, wait || DEBOUNCE_PERIOD);
    };
  };

  /**
   * Retrieves an array of elements that matches selector.
   * 
   * @param {*} selector
   * @returns {Element[]}
   */
  var $ = (function () {

    /**
     * Converts an array like value into an array.
     * 
     * @param {*} value
     * @returns {*[]}
     */
    var toArray = function (value) {
      return Array.prototype.slice.call(value);
    };

    /**
     * Determines if a value is an Element type node.
     * 
     * @param {*} value
     * @returns {boolean}
     */
    var isElement = function (value) {
      return value && value.nodeType === 1;
    };

    return function query(selector) {
      var elements = [];

      if (typeof selector === 'string') {
        elements = toArray(document.querySelectorAll(selector));
      } else if (isElement(selector)) {
        elements = [selector];
      } else if (selector instanceof NodeList) {
        elements = toArray(selector);
      } else if (Array.isArray(selector)) {
        elements = selector
          .filter(function (value) {
            return !Array.isArray(value);
          })
          .reduce(function (result, value) {
            return result.concat(query(value));
          }, []);
      }

      return elements.filter(isElement);
    };
  })();

  /**
   * Element data store api.
   */
  var store = (function () {

    /**
     * Key to identify attached store key on an element.
     * 
     * @type {string}
     */
    var expando = '__resize';

    /**
     * UID counter that guarantees a unique store id for each element.
     * 
     * @type {number}
     */
    var uid = 0;

    /**
     * Dictonary that stores element data by uid.
     * 
     * @type {object<number, *>}
     */
    var store = {};

    /**
     * Iterates over every value in the store.
     * 
     * @param {function} iterator
     */
    var forEach = function (iterator) {
      Object.keys(store).forEach(function (key) {
        iterator(store[key]);
      });
    };

    /**
     * Returns store entry for element.
     * 
     * @param {Element} element
     * @returns {*}
     */
    var get = function (element) {
      var id = element[expando];

      if (id != null) {
        return store[id];
      }

      return null;
    };

    /**
     * Removes store entry for an element.
     * 
     * @param {Element} element
     */
    var remove = function (element) {
      var id = element[expando];

      if (id != null) {
        delete store[id];
        delete element[expando];
      }
    };

    /**
     * Creates or sets a store entry for an element.
     * 
     * @param {Element} element
     * @param {*} data
     */
    var set = function (element, data) {
      var id = element[expando];

      if (id == null) {
        element[expando] = id = uid++;
      }

      store[id] = data;
    };

    return {
      forEach: forEach,
      get: get,
      remove: remove,
      set: set
    };
  })();

  /**
   * Core resize api.
   */
  var resize = (function () {

    /**
     * Is the window listener currently attached?
     * 
     * @type {boolean}
     */
    var isListening = false;

    /**
     * Determines the size of an element.
     * 
     * @param {Element} element
     * @returns {number[]}
     */
    var sizeOf = function (element) {
      return [element.clientWidth, element.clientHeight];
    };

    /**
     * Determines the equality of two size tuples.
     * 
     * @param {number[]} a
     * @param {number[]} b
     * @returns {boolean}
     */
    var sizeEquals = function (a, b) {
      return a[0] === b[0] && a[1] === b[1];
    };
    
    /**
     * Root resize handler. On every resize tick, determine any intrested elements and trigger a resize event on them.
     */
    var handleResize = function () {
      store.forEach(function (entry) {
        var element = entry.element,
            previousSize = entry.size,
            currentSize = sizeOf(element);

        if (!sizeEquals(previousSize, currentSize)) {
          store.set(element, {
            element: element,
            size: currentSize
          });

          element.dispatchEvent(new Event('resize'));
        }
      });
    };

    /**
     * Adds resize event enhancements to elements that match the selector then returns the matched elements.
     * 
     * @param {*}
     * @returns {Element[]}
     */
    var enhance = function (selector) {
      var elements = $(selector);

      elements.forEach(function (element) {
        store.set(element, {
          element: element,
          size: sizeOf(element)
        });
      });

      if (!isListening) {
        window.addEventListener('resize', debounce(handleResize));
        isListening = true;
      }

      return elements;
    };

    /**
     * Removes resize event enhancements from any elements that match the selector then returns the matched elements.
     * 
     * @param {*}
     * @returns {Element[]}
     */
    var remove = function (selector) {
      var elements = $(selector);

      elements.forEach(function (element) {
        store.remove(element);
      });

      return elements;
    };

    return {
      enhance: enhance,
      remove: remove
    };
  })();

  return resize;
}));

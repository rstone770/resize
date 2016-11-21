; (function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.resize = factory();
  }
}(this, function () {

  /**
   * Takes various dom values and returns them as an array of elements.
   * 
   * @param {*} selector
   * @returns {Element[]}
   */
  var $ = (function () {

    /**
     * Turns an array like value and returns an array.
     * 
     * @param {*} value
     * @returns {[]}
     */
    var toArray = function (value) {
      return Array.prototype.slice.call(value);
    };

    /**
     * Known selector value types.
     * 
     * @enum {number}
     */
    var SelectorKind = {
      SELECTOR: 0,
      NODE_LIST: 1,
      ELEMENT: 2,
      ARRAY: 3,
      UKNOWN: 4
    };

    /**
     * Inspects a selector value and returns a SelectorKind.
     * 
     * @param {*} selector
     * @returns {SelectorKind}
     */
    var getSelectorKind = function (selector) {
      if (selector == null) {
        return SelectorKind.UKNOWN;
      } else if (selector instanceof NodeList) {
        return SelectorKind.NODE_LIST;
      } else if (typeof selector === 'string') {
        return SelectorKind.SELECTOR;
      } else if (typeof selector.nodeType === 'number') {
        return SelectorKind.ELEMENT;
      } else if (Array.isArray(selector)) {
        return SelectorKind.ARRAY;
      }

      return SelectorKind.UKNOWN;
    };

    /**
     * Queries the document using a selector and returns array of elements that match.
     * 
     * @param {*} selector
     * @returns {Element[]}
     */
    var $ = function (selector) {
      switch (getSelectorKind(selector)) {
        case SelectorKind.SELECTOR:
          return toArray(document.querySelectorAll(selector));
        case SelectorKind.NODE_LIST:
          return toArray(selector);
        case SelectorKind.ELEMENT:
          return [selector];
        case SelectorKind.ARRAY:
          return selector
            .filter(function (selector) {
              return getSelectorKind(selector) !== SelectorKind.ARRAY;
            })
            .reduce(function (result, selector) {
              return result.concat($(selector));
            }, []);
      }

      return [];
    };

    return $;
  })();

  /**
   * Subscriber collection.
   */
  var subscribers = (function () {

    /**
     * Struct that allows for unique identification in an unordered collection.
     * 
     * @typedef {{key: number, value: *}} KeyValuePair
     */

    /**
     * subscriber key counter guarantees a unique key per subscriber.
     * 
     * @type {number}
     */
    var counter = 0;

    /**
     * Key value collection for subscribers.
     * 
     * @type{KeyValuePair[]}
     */
    var items = [];

    /**
     * Iterators over subscribers and calls iterator with the value.
     * 
     * @param {function(*)} iterator
     */
    var forEach = function (iterator) {
      items.forEach(function (item) {
        return iterator(item.value);
      });
    };

    /**
     * Removes subscribers that fails predicate.
     * 
     * @param {function(number)} predicate
     */
    var filterById = function (predicate) {
      items = items.filter(function (item) {
        return predicate(item.id);
      });
    };

    /**
     * Inserts a new item into the collection and returns the inserted id.
     * 
     * @param {*} value
     * @returns {number}
     */
    var insert = function (value) {
      var id = counter++;

      items.push({
        id: id,
        value: value
      });

      return id;
    };

    return {
      forEach: forEach,
      filterById: filterById,
      insert: insert
    }
  })();

  /**
   * Compares two size tuples.
   * 
   * @param {number[]} a
   * @param {number[]} b
   * @returns {boolean}
   */
  var sizeEquals = function (a, b) {
    return a[0] === b[0] && a[1] === b[1];
  };

  /**
   * Determines size of elements.
   * 
   * @param {Element} element
   * @returns {number[]}
   */
  var sizeOf = function (element) {
    return [element.clientWidth, element.clientHeight];
  };

  /**
   * Determines if we are currently listening for resize events on the window.
   * 
   * @type {boolean}
   */
  var isListening = false;

  /**
   * Creates a new subscriber item value.
   * 
   * @param {*} context
   * @param {function(*)} handler
   * @returns {{context: *, handler: function(*), size: number[]}}
   */
  var createSubscriber = function (context, handler) {
    var size = [];

    if (context !== window) {
      size = sizeOf(context);
    }

    return {
      context: context,
      handler: handler,
      size: size
    };
  };

  /**
   * Called everytime a window resize occurs. On resize, determine all intrested subscribers and call their handlers with context.
   */
  var handleResize = function () {
    subscribers.forEach(function (subscriber) {
      var context = subscriber.context;
      
      if (context === window) {
        subscriber.handler(context);
      } else {
        var currentSize = sizeOf(context);

        if (!sizeEquals(currentSize, subscriber.size)) {
          subscriber.size = currentSize;
          subscriber.handler(context);
        }
      }
    });
  };

  /**
   * Attaches a resize subscriber to a list of elements and returns an unsubscribe function.
   * 
   * @param {Element[]} elements
   * @param {function} callback
   * @returns {function}
   */
  var subscribeToElements = function (elements, callback) {
    var subscriberIds = elements.map(function (element) {
      return subscribers.insert(createSubscriber(element, callback));
    });

    return function () {
      subscribers.filterById(function (id) {
        return subscriberIds.indexOf(id) === -1;
      });
    };
  };

  /**
   * Attaches a resize subscriber to the window and returns an unsubscribe function.
   * 
   * @param {function} callback
   * @returns {function}
   */
  var subscribeToWindow = function (callback) {
    var subscriberId = subscribers.insert(createSubscriber(window, callback));

    return function () {
      subscribers.filterById(function (id) {
        return subscriberId !== id;
      });
    };
  };
  
  /**
   * Subscribes resize events to a selector or window and returns an unsubscribe function.
   * 
   * @example
   *  resize('body', (event) => { ... }); // Subscribes to body tag resize.
   *  resize((event) => { ... }); // Subscribes to window resize.
   *  resize($('.selector, .another-selector').toArray(), (event) => { ... }); // Subscribes to an array of DOM elements resizes.
   *  resize(document.body, (event) => { ... }); // Subscribes to single element.
   * 
   * @param {*|function} selector
   * @param {function=} callback
   * @returns {function}
   */
  var resize = function (selector, callback) {
    if (arguments.length === 1) {
      return resize(window, selector);
    } else if (typeof callback !== 'function') {
      throw new TypeError('callback must be a function.');
    }


    if (isListening === false) {
      isListening = true;
      window.addEventListener('resize', handleResize);
    }

    return selector === window
      ? subscribeToWindow(callback)
      : subscribeToElements($(selector), callback);
  };

  return resize;
}));
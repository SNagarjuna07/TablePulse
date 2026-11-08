(function () {
  'use strict';

  // Fades and lifts an element in when it scrolls into view.
  // Usage: <div tp-reveal reveal-delay="120">...</div>
  angular.module('tablepulse').directive('tpReveal', function () {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        var node = element[0];
        node.classList.add('reveal');
        node.style.transitionDelay = (Number(attrs.revealDelay) || 0) + 'ms';

        if (!('IntersectionObserver' in window)) {
          node.classList.add('in');
          return;
        }
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              node.classList.add('in');
              observer.unobserve(node);
            }
          });
        }, { threshold: 0.15 });
        observer.observe(node);
        scope.$on('$destroy', function () { observer.disconnect(); });
      }
    };
  });
})();

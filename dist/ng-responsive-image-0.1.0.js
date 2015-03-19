/**!
 * ng-responsive-image - v0.1.0 - 2015-03-19
 *
 * Copyright (c) 2015 [object Object]
 * Distributed under the MIT licence
 */
(function (app) {
  'use strict';

  app.factory('matchImage', matchImageFactory);

  matchImageFactory.$inject = [ '$window' ];
  function matchImageFactory ($window) {

    // Outside of the actual function since those matches need not be repeated more than once.
    var pixelDensity =

    ($window.matchMedia(
      'only screen and (-webkit-min-device-pixel-ratio: 3), ' + // Safari & iOS Safari & older android browser
      'only screen and (min-resolution: 3dppx), ' +             // Standard - Chrome, Firefox, Chrome for Android
      'only screen and (min-resolution: 288dpi)'                // IE 9-11, Opera Mini
    ).matches) ? 3 :

    ($window.matchMedia(
      'only screen and (-webkit-min-device-pixel-ratio: 1.5), ' +
      'only screen and (min-resolution: 1.5dppx), ' +
      'only screen and (min-resolution: 144dpi)'
    ).matches) ? 2 :

    1;

    return function matchImage (imgObj, width, ratio) {

      if (!imgObj || !width || !ratio) {
        throw new Error('r-src must be provided an src object, a width and a ratio.');
      }

      // Iterate over src to find the best possible match
      var match = Object.keys(imgObj)

      // Format the incoming data into an easily iterable format
      // Assume data in a format like { url_100x100: 'https://example.com', ... }
      .map(function formatImageObject (item, index, array) {
        var m      = item.match(/^url_(\d+)x(\d+)$/),
            width  = m[1],
            height = m[2],
            ratio  = width / height;
        if (!width || !height || !ratio) {
          throw new Error('Unexpected image object. rSrc needs keys of the form url_000x000 with urls as values');
        }
        return [ ratio, width, imgObj[item] ];
      })

      // Find images that match the exact ratio or taller
      .filter(function filterImagesByRatio (item, index, array) {
        return +item[0] <= +ratio;
      })

      // Sort images by ratio for simpler selection
      .sort(function sortImagesByRatio (a, b) {
        return a[0] - b[0];
      })

      // Keep only the highest ratio images. If we have an exact match, those will be it. Otherwise those will be
      // the least tall images that are still tall enough to fit - we can't leave empty spaces.
      .reduceRight(function keepHighestRatioImages (acc, item, index, array) {
        return (acc.length > 0) && (+item[0] < acc[0][0]) ? acc : acc.concat([ item ]);
      }, [])

      // Find images large enough to fit, or larger
      .filter(function filterImagesByWidth (item, index, array) {
        return +item[1] >= width * pixelDensity;
      })

      // Keep the smallest image that did fit. If there's only one image, this will be it.
      .reduce(function keepSmallestWidthImages (acc, item, index, array) {
        return !acc ? item :                        // If there's nothing yet, take the first item that comes
          (+item[1] < +acc[1]) ? item : acc;        // If the item is smaller than what we had, take it instead
      });

      // Programmer error, we should just throw and try to be helpful
      if (!match) {
        throw new Error('No image in src fitting width (' + width + '), ' +
          'pixel density (' + pixelDensity + '), & ratio (' + ratio + ') constraints');
      }

      return match[2];
    };
  }

})(angular.module('ng-responsive-image.matcher', [

]));
/**
 * Responsive images directive
 *
 * This module adds a directive that selects images based on width & ratio as constraints, and the
 * device's pixel density, and takes the best possible image fitting those criteria.
 *
 * Lacking a match, it will throw with the data it was fed.
 */
(function (app) {
  'use strict';

  app.directive('rSrc', rSrc);

  rSrc.$inject = [ 'matchImage' ];
  function rSrc (matchImage) {

    return {
      restrict: 'A',
      scope: {
        src: '=rSrc'
      },
      link: function linkResponsiveSrc (scope, element, attrs) {
        var width, ratio;

        // Calculate the constraints and then set the image's src ASAP
        setImage(constraints());

        // Set it again every time the bound image object changes (without recalculating constraints)
        scope.$watch('src', setImage);

        function setImage () {
          var url = matchImage(scope.src, width, ratio);

          if (element.attr('background')) {
            element.css('background-image', 'url(' + url + ')');
          } else {
            element.attr('src', url);
          }
        }

        // NB: constraints actually mutates on the parent's width & ratio variables.
        function constraints () {

          // For width, simply take the attribute, or, for lack thereof, the element's actual width
          width = +attrs.width           ||
                  element[0].clientWidth ||
                  attrs.height * attrs.ratio   ||
                  element[0].clientHeight * attrs.ratio;

          // If nothing is explicitly specified and the CSS does not handle width either, throw
          if (!width) {
            throw new Error('rSrc needs either a width or an element with a CSS applied width');
          }

          // For ratio, take an explicit ratio, calculate it from an explcit height, or from an actual height
          ratio = +attrs.ratio ||
                  (attrs.height ? (width / attrs.height) : (width / element[0].clientHeight));

          // If no ratio was specified or possible to calculate (for the lack of an explicit or CSS-defined height),
          // throw. NB: x / 0 where x is a number returns Infinity.
          if (!ratio || ratio === Infinity) {
            throw new Error('rSrc needs either a height, a ratio, or an element with a CSS applied height');
          }
        }
      }
    };
  }

}(angular.module('ng-responsive-image', [
  'ng-responsive-image.matcher'
])));
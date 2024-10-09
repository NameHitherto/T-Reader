window._iconfont_svg_string_ = `
<svg>
  <symbol id="icon-ashbin" viewBox="0 0 1024 1024">
    <path d="M874.666667 241.066667h-202.666667V170.666667c0-40.533333-34.133333-74.666667-74.666667-74.666667h-170.666666c-40.533333 0-74.666667 34.133333-74.666667 74.666667v70.4H149.333333c-17.066667 0-32 14.933333-32 32s14.933333 32 32 32h53.333334V853.333333c0 40.533333 34.133333 74.666667 74.666666 74.666667h469.333334c40.533333 0 74.666667-34.133333 74.666666-74.666667V305.066667H874.666667c17.066667 0 32-14.933333 32-32s-14.933333-32-32-32zM416 170.666667c0-6.4 4.266667-10.666667 10.666667-10.666667h170.666666c6.4 0 10.666667 4.266667 10.666667 10.666667v70.4h-192V170.666667z m341.333333 682.666666c0 6.4-4.266667 10.666667-10.666666 10.666667H277.333333c-6.4 0-10.666667-4.266667-10.666666-10.666667V309.333333h490.666666V853.333333z" fill="#666666"></path>
    <path d="M426.666667 736c17.066667 0 32-14.933333 32-32V490.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v213.333333c0 17.066667 14.933333 32 32 32zM597.333333 736c17.066667 0 32-14.933333 32-32V490.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v213.333333c0 17.066667 14.933333 32 32 32z" fill="#666666"></path>
  </symbol>
  <symbol id="icon-arrow-double-right" viewBox="0 0 1024 1024">
    <path d="M544 522.666667c0-8.533333-4.266667-17.066667-10.666667-23.466667L192 189.866667c-12.8-12.8-34.133333-10.666667-44.8 2.133333-12.8 12.8-10.666667 34.133333 2.133333 44.8l315.733334 285.866667L149.333333 808.533333c-12.8 12.8-14.933333 32-2.133333 44.8 6.4 6.4 14.933333 10.666667 23.466667 10.666667 8.533333 0 14.933333-2.133333 21.333333-8.533333l341.333333-309.333334c6.4-6.4 10.666667-14.933333 10.666667-23.466666z" fill="#666666"></path>
    <path d="M864 499.2l-341.333333-309.333333c-12.8-12.8-34.133333-10.666667-44.8 2.133333-12.8 12.8-10.666667 34.133333 2.133333 44.8l315.733333 285.866667-315.733333 285.866666c-12.8 12.8-14.933333 32-2.133333 44.8 6.4 6.4 14.933333 10.666667 23.466666 10.666667 8.533333 0 14.933333-2.133333 21.333334-8.533333l341.333333-309.333334c6.4-6.4 10.666667-14.933333 10.666667-23.466666 0-8.533333-4.266667-17.066667-10.666667-23.466667z" fill="#666666"></path>
  </symbol>
  <symbol id="icon-prompt-filling" viewBox="0 0 1024 1024">
    <path d="M512 74.666667c241.066667 0 437.333333 196.266667 437.333333 437.333333S753.066667 949.333333 512 949.333333 74.666667 753.066667 74.666667 512 270.933333 74.666667 512 74.666667z m0 341.333333c-17.066667 0-32 14.933333-32 32v300.8c2.133333 17.066667 14.933333 29.866667 32 29.866667s32-14.933333 32-32V445.866667c-2.133333-17.066667-14.933333-29.866667-32-29.866667z m0-160c-23.466667 0-42.666667 19.2-42.666667 42.666667s19.2 42.666667 42.666667 42.666666 42.666667-19.2 42.666667-42.666666-19.2-42.666667-42.666667-42.666667z" fill="#666666"></path>
  </symbol>
</svg>
`;

(function (window) {
  var script = document.getElementsByTagName("script");
  var lastScript = script[script.length - 1];
  var injectCss = lastScript.getAttribute("data-injectcss");
  var disableInjectSvg = lastScript.getAttribute("data-disable-injectsvg");

  if (!disableInjectSvg) {
    var appendSvg = function () {
      var div = document.createElement("div");
      div.innerHTML = window._iconfont_svg_string_;
      var svg = div.getElementsByTagName("svg")[0];
      if (svg) {
        svg.setAttribute("aria-hidden", "true");
        svg.style.position = "absolute";
        svg.style.width = 0;
        svg.style.height = 0;
        svg.style.overflow = "hidden";
        var body = document.body;
        if (body.firstChild) {
          body.insertBefore(svg, body.firstChild);
        } else {
          body.appendChild(svg);
        }
      }
    };

    if (injectCss && !window.__iconfont__svg__cssinject__) {
      window.__iconfont__svg__cssinject__ = true;
      try {
        document.write("<style>.svgfont {display: inline-block;width: 1em;height: 1em;fill: currentColor;vertical-align: -0.1em;font-size:16px;}</style>");
      } catch (e) {
        console && console.log(e);
      }
    }

    if (document.addEventListener) {
      if (~["complete", "loaded", "interactive"].indexOf(document.readyState)) {
        setTimeout(appendSvg, 0);
      } else {
        var onDomContentLoaded = function () {
          document.removeEventListener("DOMContentLoaded", onDomContentLoaded, false);
          appendSvg();
        };
        document.addEventListener("DOMContentLoaded", onDomContentLoaded, false);
      }
    } else if (document.attachEvent) {
      var onReadyStateChange = function () {
        if (document.readyState === "complete") {
          document.onreadystatechange = null;
          appendSvg();
        }
      };
      document.attachEvent("onreadystatechange", onReadyStateChange);

      var doScrollCheck = function () {
        try {
          document.documentElement.doScroll("left");
        } catch (e) {
          return setTimeout(doScrollCheck, 50);
        }
        appendSvg();
      };
      doScrollCheck();
    }
  }
})(window);
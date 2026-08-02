/*
 * Contact guard — keeps the email address and phone number out of the
 * HTML source so markup scrapers never see them. Values are stored
 * reversed + base64 and are only injected into the page after a real
 * human gesture (pointer, key, touch, scroll, or focus) — which most
 * headless crawlers never produce, even when they execute JavaScript.
 */
(function () {
  'use strict';

  var CONTACTS = {
    email: { scheme: 'mailto:', value: 'b2MuYml0YWhrbGVAbWVlcmFL' },
    phone: { scheme: 'tel:', value: 'MTExOTEyMjQwNDEr', display: 'MTExOS0xMjIgKTQwNCg=' }
  };
  var HUMAN_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll', 'focusin'];
  var revealed = false;

  function decode(encoded) {
    try {
      return atob(encoded).split('').reverse().join('');
    } catch (err) {
      return null;
    }
  }

  function revealNode(node) {
    var contact = CONTACTS[node.getAttribute('data-guard')];
    if (!contact) { return; }

    var value = decode(contact.value);
    if (!value) { return; }

    node.setAttribute('href', contact.scheme + value);

    var text = node.querySelector('.guard__text');
    if (text) {
      text.textContent = contact.display ? (decode(contact.display) || value) : value;
    }
  }

  function revealAll() {
    if (revealed) { return; }
    revealed = true;

    HUMAN_EVENTS.forEach(function (name) {
      window.removeEventListener(name, revealAll, true);
    });

    var nodes = document.querySelectorAll('[data-guard]');
    Array.prototype.forEach.call(nodes, revealNode);
  }

  HUMAN_EVENTS.forEach(function (name) {
    window.addEventListener(name, revealAll, { capture: true, passive: true });
  });

  // Safety net: a click on a still-hidden link reveals instead of jumping to "#".
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('[data-guard]') : null;
    if (link && link.getAttribute('href') === '#') {
      event.preventDefault();
      revealAll();
    }
  });
})();

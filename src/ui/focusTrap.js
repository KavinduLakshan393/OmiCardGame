const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'select:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

const stack = [];
let listening = false;

function isHTMLElement(value) {
    const HTMLElementCtor = globalThis.HTMLElement;
    return typeof HTMLElementCtor === 'function' && value instanceof HTMLElementCtor;
}

function focusables(container) {
    return [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function focusInitial(entry) {
    const preferred = typeof entry.initialFocus === 'function'
        ? entry.initialFocus()
        : entry.initialFocus;
    const target = isHTMLElement(preferred) && !preferred.hidden
        ? preferred
        : focusables(entry.container)[0] ?? entry.container;

    if (!target.hasAttribute('tabindex') && target === entry.container) {
        target.setAttribute('tabindex', '-1');
        entry.addedContainerTabIndex = true;
    }
    target.focus({ preventScroll: true });
}

function handleKeydown(event) {
    const entry = stack.at(-1);
    if (!entry) return;

    if (event.key === 'Escape' && typeof entry.onEscape === 'function') {
        event.preventDefault();
        event.stopPropagation();
        entry.onEscape();
        return;
    }

    if (event.key !== 'Tab') return;

    const items = focusables(entry.container);
    if (items.length === 0) {
        event.preventDefault();
        entry.container.focus({ preventScroll: true });
        return;
    }

    const first = items[0];
    const last = items.at(-1);
    const active = globalThis.document?.activeElement;

    if (event.shiftKey && (active === first || !entry.container.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (active === last || !entry.container.contains(active))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
    }
}

function ensureListener() {
    if (listening || !globalThis.document) return;
    globalThis.document.addEventListener('keydown', handleKeydown, true);
    listening = true;
}

function maybeRemoveListener() {
    if (!listening || stack.length > 0 || !globalThis.document) return;
    globalThis.document.removeEventListener('keydown', handleKeydown, true);
    listening = false;
}

/**
 * Trap keyboard focus inside one visible dialog-like surface.
 *
 * Traps are stack-aware so a secondary modal (for example Statistics opened
 * from a result dialog) can temporarily sit above another modal and return
 * focus to the exact invoking control when it closes.
 */
export function activateFocusTrap(container, {
    initialFocus = null,
    onEscape = null,
    restoreFocus = true,
} = {}) {
    if (!isHTMLElement(container)) {
        throw new TypeError('Focus trap container must be an HTMLElement');
    }

    const existingIndex = stack.findIndex(entry => entry.container === container);
    if (existingIndex >= 0) stack.splice(existingIndex, 1);

    const entry = {
        container,
        initialFocus,
        onEscape,
        restoreFocus,
        returnFocus: isHTMLElement(globalThis.document?.activeElement)
            ? globalThis.document.activeElement
            : null,
        addedContainerTabIndex: false,
    };

    stack.push(entry);
    ensureListener();
    queueMicrotask(() => {
        if (stack.at(-1) === entry) focusInitial(entry);
    });
    return entry;
}

/** Close a trap. Returns true when a matching active trap existed. */
export function deactivateFocusTrap(container, { restoreFocus = true } = {}) {
    const index = stack.findIndex(entry => entry.container === container);
    if (index < 0) return false;

    const [entry] = stack.splice(index, 1);
    if (entry.addedContainerTabIndex) entry.container.removeAttribute('tabindex');

    const shouldRestore = restoreFocus && entry.restoreFocus && isHTMLElement(entry.returnFocus);
    if (shouldRestore && !entry.returnFocus.hidden && !entry.returnFocus.hasAttribute('disabled')) {
        queueMicrotask(() => entry.returnFocus.focus({ preventScroll: true }));
    } else if (stack.length > 0 && index === stack.length) {
        queueMicrotask(() => focusInitial(stack.at(-1)));
    }

    maybeRemoveListener();
    return true;
}

/** Primarily for deterministic UI tests and page teardown. */
export function clearFocusTraps({ restoreFocus = false } = {}) {
    while (stack.length) {
        deactivateFocusTrap(stack.at(-1).container, { restoreFocus });
    }
}

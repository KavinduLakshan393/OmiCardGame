import { ANIMATION_SPEED, REDUCED_MOTION } from '../storage/settings.js';

const SPEED_SCALE = Object.freeze({
    [ANIMATION_SPEED.RELAXED]: 1.35,
    [ANIMATION_SPEED.NORMAL]: 1,
    [ANIMATION_SPEED.FAST]: 0.65,
});

let activeSettings = {
    animationSpeed: ANIMATION_SPEED.NORMAL,
    reducedMotion: REDUCED_MOTION.SYSTEM,
};

function systemPrefersReducedMotion() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function configureMotion(settings = {}) {
    activeSettings = {
        animationSpeed: Object.hasOwn(SPEED_SCALE, settings.animationSpeed)
            ? settings.animationSpeed
            : ANIMATION_SPEED.NORMAL,
        reducedMotion: Object.values(REDUCED_MOTION).includes(settings.reducedMotion)
            ? settings.reducedMotion
            : REDUCED_MOTION.SYSTEM,
    };

    const root = globalThis.document?.documentElement;
    if (root) {
        root.dataset.animationSpeed = activeSettings.animationSpeed;
        root.dataset.motion = isReducedMotion() ? 'reduced' : 'full';
        root.style.setProperty('--motion-medium', `${duration(420)}ms`);
        root.style.setProperty('--motion-fast', `${duration(220)}ms`);
        root.style.setProperty('--deal-stagger', `${duration(45)}ms`);
    }

    return { ...activeSettings };
}

export function isReducedMotion() {
    if (activeSettings.reducedMotion === REDUCED_MOTION.REDUCE) return true;
    if (activeSettings.reducedMotion === REDUCED_MOTION.FULL) return false;
    return systemPrefersReducedMotion();
}

export function duration(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new RangeError(`Invalid presentation duration: ${milliseconds}`);
    }
    if (isReducedMotion()) return 0;
    return Math.round(milliseconds * SPEED_SCALE[activeSettings.animationSpeed]);
}

export function wait(milliseconds) {
    const adjusted = duration(milliseconds);
    return adjusted === 0
        ? Promise.resolve()
        : new Promise(resolve => setTimeout(resolve, adjusted));
}

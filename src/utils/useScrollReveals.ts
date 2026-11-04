import { useEffect } from 'react';

// Observe asynchronously loaded cards too, without hiding anything before JS is ready.
export function useScrollReveals() {
  useEffect(() => {
    const root = document.getElementById('main-content');
    if (!root || !('IntersectionObserver' in window)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        target.setAttribute('data-reveal', 'visible');
        observer.unobserve(target);
      });
    }, { threshold: 0.08 });
    const scan = () => {
      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach(element => {
        if (seen.has(element)) return;
        seen.add(element);
        if (motion.matches) { element.dataset.reveal = 'visible'; return; }
        const siblings = element.parentElement?.children;
        const index = siblings ? Array.from(siblings).indexOf(element) : 0;
        const columns = element.parentElement?.classList.contains('product-grid') ? 4 : 3;
        element.style.setProperty('--reveal-delay', `${(index % columns) * 60}ms`);
        element.dataset.reveal = 'pending';
        observer.observe(element);
      });
    };
    const reduceMotion = () => {
      if (!motion.matches) return;
      observer.disconnect();
      root.querySelectorAll('[data-reveal="pending"]').forEach(element => element.setAttribute('data-reveal', 'visible'));
    };
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: true });
    motion.addEventListener('change', reduceMotion);
    return () => { observer.disconnect(); mutations.disconnect(); motion.removeEventListener('change', reduceMotion); };
  }, []);
}

// The office's menus: a card in the theme's popover colours, like the New space
// dialog, with a folder tab saying what it is for (a lit desk-lamp mark on it),
// one ruled line per item, the picked line highlighted with a lamp-amber edge.
// Used by the boss's pickers, the right-click menus (office-menu), the tab bar's
// "+" (office-new-menu), the add menu (office-add) and the Files panel
// (office-files).
//
// A mod can't import outside its folder, so this file is the source and
// office-menu/card.js, office-new-menu/card.js, office-add/card.js and
// office-files/card.js are verbatim copies (test/lib.test.mjs fails when they
// drift): edit here, then copy.
import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme } from "herdr";

// The warm light of the office's windows and lamps (the New space dialog's doors).
export const LAMP = "#f0c06e";
const TICK = "#5fb97a";

// The theme's colours for a card, with fallbacks for a theme that lacks one.
export function ink() {
  const t = theme() ?? {};
  return {
    sheet: t.popover ?? t.background, edge: t.border, tab: t.raised ?? t.popover, rule: t.border,
    text: t.foreground, dim: t.dim ?? t.muted, muted: t.muted, hover: t.hover, pick: t.selected ?? t.hover,
    red: t.blocked ?? "#e5675c", tick: TICK, tag: t.background ?? t.raised,
  };
}

// The folder tab on top of a card: a lamp mark, then the title.
export const cardTab = (title) => {
  const c = ink();
  return h_flex().flex_none()
    .child(h_flex().h(20).max_w(210).px(9).gap(6).items_center().bg(c.tab).border_t(1).border_l(1).border_r(1).border_color(c.edge)
      .child(div().w(7).h(4).flex_none().bg(LAMP))
      .child(div().min_w(0).truncate().text_size(9.5).font_bold().text_color(c.muted).child(title)));
};

// The sheet under the tab: dresses a v_flex.
export const sheet = (el) => {
  const c = ink();
  return el.bg(c.sheet).border(1).border_color(c.edge);
};

// A whole card: tab, then the sheet holding `rows`.
export const card = (id, title, rows) => v_flex().id(id).w_full().flex_none()
  .child(cardTab(title))
  .child(sheet(v_flex().py(3)).children(rows));

// One ruled line (dresses an h_flex with an id): `on` is the picked or
// keyboard-chosen one (highlighted, a lamp-amber edge on its left), `danger`
// reads in red (Close).
export const line = (el, { on = false, danger = false, enabled = true } = {}) => {
  const c = ink();
  return el.relative().h(28).px(10).gap(8).items_center().flex_none().border_b(1).border_color(c.rule).text_size(12)
    .text_color(!enabled ? c.dim : danger ? c.red : c.text)
    .when(on, (e) => e.bg(c.pick).child(div().absolute().left(0).top(0).bottom(0).w(2).bg(LAMP)))
    .when(enabled, (e) => e.cursor_pointer().hover((s) => s.bg(on ? c.pick : c.hover)));
};

// A small heading inside the sheet ("START AN AGENT").
export const caption = (text) => div().px(10).pt(7).pb(3).flex_none().text_size(9.5).font_bold().text_color(ink().dim).child(text);

// A double rule before the last group (Close, New space).
export const rule = () => div().flex_none().h(3).border_t(1).border_b(1).border_color(ink().rule);

// A key or note on a little tag, at a line's right end.
export const keyTag = (text) => {
  const c = ink();
  return div().flex_none().max_w(96).truncate().px(4).bg(c.tag).border(1).border_color(c.edge).text_size(9.5).text_color(c.dim).child(text);
};

export function panel(title, subtitle, body, cls, aside) {
  return (
    '<section class="panel ' +
    (cls || "") +
    '"><div class="panel-head"><div><div class="panel-title">' +
    title +
    "</div>" +
    (subtitle ? '<div class="panel-subtitle">' + subtitle + "</div>" : "") +
    "</div>" +
    (aside || "") +
    '</div><div class="panel-body">' +
    body +
    "</div></section>"
  );
}

export function metricCell(name, text) {
  return '<span class="mcell" data-metric="' + name + '">' + text + "</span>";
}

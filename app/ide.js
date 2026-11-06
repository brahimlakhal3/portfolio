/* ==========================================================================
   ide.js — renders the brahimlakhal3 workspace as an IDE
   No build step, no dependencies, works from file:// and any static host.
   ========================================================================== */
(function () {
  "use strict";

  window.injectSprite();

  var OWNER = window.OWNER;
  var GROUPS = window.GROUPS;
  var LANGS = window.LANGS;
  var META = window.REPO_META;

  var PROJECTS = window.PROJECTS.map(function (p) {
    var m = META[p.repo] || {};
    var q = Object.assign({}, p, m);
    q.url = OWNER.url + "/" + p.repo;
    q.clone = q.url + ".git";
    q.readme = q.url + "#readme";
    return q;
  });

  var BY_ID = {};
  var BY_REPO = {};
  PROJECTS.forEach(function (p) {
    BY_ID[p.id] = p;
    BY_REPO[p.repo.toLowerCase()] = p;
  });

  /* ------------------------------------------------------------------ utils */
  var $ = function (sel) {
    return document.querySelector(sel);
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var ic = function (name, size) {
    return '<svg class="mi mi-' + (size || 14) + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  };
  var kb = function (n) {
    return n >= 1024 ? (n / 1024).toFixed(1) + " MB" : n + " kB";
  };
  var ago = function (iso) {
    var d = (Date.now() - new Date(iso + "T00:00:00Z").getTime()) / 864e5;
    if (d < 1) return "today";
    if (d < 2) return "yesterday";
    if (d < 31) return Math.round(d) + " days ago";
    if (d < 365) return Math.round(d / 30.4) + " months ago";
    return (d / 365).toFixed(1) + " years ago";
  };
  var langColor = function (l) {
    return (LANGS[l] && LANGS[l].color) || "var(--dim)";
  };
  var langIcon = function (l) {
    return (LANGS[l] && LANGS[l].icon) || "file-code";
  };
  var groupOf = function (id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
    return null;
  };
  var plural = function (n, w, p) {
    return n + " " + (n === 1 ? w : p || w + "s");
  };

  function copyText(text, ok) {
    function legacy() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta);
      ta.select();
      var done = false;
      try {
        done = document.execCommand("copy");
      } catch (e) {
        done = false;
      }
      ta.remove();
      done ? ok() : toast("Copy blocked by the browser — select and copy manually", "warn");
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, legacy);
    } else legacy();
  }

  var toastHost = $("#toasts");
  function toast(msg, kind) {
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML =
      ic(kind === "warn" ? "alert-circle-outline" : "check-circle-outline", 16) + "<span>" + esc(msg) + "</span>";
    if (kind === "warn") el.querySelector(".mi").style.color = "var(--warn)";
    toastHost.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .25s";
      el.style.opacity = "0";
      setTimeout(function () {
        el.remove();
      }, 260);
    }, 2400);
  }

  /* --------------------------------------------------------------- state */
  var LS = "brahimlakhal3.ide.v1";
  var state = {
    view: "project",
    tool: true,
    right: true,
    bottom: false,
    mode: "code",
    tabs: ["workspace"],
    active: "workspace",
    filter: "",
    collapsed: {},
    term: [],
  };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(LS) || "{}"));
  } catch (e) {}
  if (!state.tabs.length) state.tabs = ["workspace"];
  if (state.tabs.indexOf(state.active) < 0) state.active = state.tabs[0];

  function save() {
    try {
      localStorage.setItem(
        LS,
        JSON.stringify({
          view: state.view,
          tool: state.tool,
          right: state.right,
          bottom: state.bottom,
          mode: state.mode,
          tabs: state.tabs,
          active: state.active,
          collapsed: state.collapsed,
        }),
      );
    } catch (e) {}
  }

  var tabMeta = { workspace: { title: "workspace", icon: "folder-text", path: OWNER.login + "/workspace" } };
  PROJECTS.forEach(function (p) {
    tabMeta[p.id] = { title: p.repo, icon: langIcon(p.lang), path: p.path + "/README.md", repo: p.repo };
  });

  /* -------------------------------------------------------- document model */
  var PROJECT_HIDE = ["Manifest"];
  var WORKSPACE_HIDE = ["Manifest", "Collections", "Language mix", "Last activity"];

  function hiddenSections(kind, mode) {
    var base = kind === "workspace" ? WORKSPACE_HIDE : PROJECT_HIDE;
    return mode === "code" ? [] : base;
  }

  function projectMd(p) {
    var g = groupOf(p.group);
    var L = [];
    L.push("# " + p.repo);
    L.push("");
    L.push("> " + p.tagline);
    L.push("");
    L.push("## Manifest");
    L.push("");
    L.push("```yaml");
    L.push("id:        " + p.id);
    L.push("repo:      " + p.repo);
    L.push("folder:    " + (g ? g.dir : p.group));
    L.push("language:  " + p.lang);
    L.push("branch:    " + p.branch);
    L.push("created:   " + p.created);
    L.push("last_push: " + p.pushed + "   # " + ago(p.pushed));
    L.push("size_kb:   " + p.sizeKb);
    L.push("stars:     " + p.stars);
    L.push("forks:     " + p.forks);
    L.push("issues:    " + p.issues);
    L.push("license:   none declared");
    L.push("clone:     " + p.clone);
    L.push("```");
    L.push("");
    L.push("## Overview");
    L.push("");
    L.push(overview(p));
    L.push("");
    L.push("## Tech stack");
    L.push("");
    p.stack.forEach(function (s) {
      L.push("- " + s);
    });
    L.push("");
    L.push("## Highlights");
    L.push("");
    p.highlights.forEach(function (h) {
      L.push("- " + h);
    });
    L.push("");
    L.push("## Run it");
    L.push("");
    L.push("```sh");
    p.run.forEach(function (r) {
      L.push(r);
    });
    L.push("```");
    L.push("");
    L.push("## Excerpt — " + p.snippet.file);
    L.push("");
    L.push("```" + p.snippet.lang);
    p.snippet.lines.forEach(function (s) {
      L.push(s);
    });
    L.push("```");
    if (p.caveat) {
      L.push("");
      L.push("## Inspection notes");
      L.push("");
      L.push("> " + p.caveat);
    }
    L.push("");
    L.push("## Links");
    L.push("");
    L.push("- [GitHub repository](" + p.url + ")");
    L.push("- [Rendered README](" + p.readme + ")");
    L.push("- [Raw sources tree](" + OWNER.url + "?tab=repositories)");
    L.push("");
    return L.join("\n");
  }

  function overview(p) {
    var s = p.title + " lives in `" + (groupOf(p.group) || { dir: p.group }).dir + "/` and is written in " + p.lang + ".";
    var tech = p.stack.slice(0, 4).join(", ");
    s += " The stack reported by the repository is " + tech + ".";
    s += " Created " + p.created + ", last pushed " + p.pushed + " (" + ago(p.pushed) + "), " + kb(p.sizeKb) + " of tracked content on `" + p.branch + "`.";
    if (p.topics.length) s += " GitHub topics: " + p.topics.map(function (t) { return "`" + t + "`"; }).join(", ") + ".";
    return s;
  }

  function workspaceMd() {
    var L = [];
    L.push("# brahimlakhal3 / workspace");
    L.push("");
    L.push("> Fifteen public repositories, opened the way I actually work in them — as one workspace.");
    L.push("");
    L.push("## Manifest");
    L.push("");
    L.push("```yaml");
    L.push("owner:     " + OWNER.login);
    L.push("profile:   " + OWNER.url);
    L.push("since:     " + OWNER.since);
    L.push("repos:     " + PROJECTS.length);
    L.push("followers: " + OWNER.followers);
    L.push("stars:     " + PROJECTS.reduce(function (a, p) { return a + p.stars; }, 0));
    L.push("theme:     IntelliJ New UI Dark + One Dark Pro");
    L.push("font:      JetBrains Mono SemiBold");
    L.push("icons:     Material Design Icons 24x24");
    L.push("```");
    L.push("");
    L.push("## What this workspace covers");
    L.push("");
    L.push(
      "Native **Android** apps in Kotlin and Jetpack Compose, their **Bun** and **Node** back-ends, two **TypeScript** web platforms, **Spring Boot** labs, **Jupyter** machine-learning practicums and a **LaTeX** course template. Open any file in the project tree to read its manifest, stack and highlights.",
    );
    L.push("");
    L.push("## Collections");
    L.push("");
    GROUPS.forEach(function (g) {
      var list = PROJECTS.filter(function (p) {
        return p.group === g.id;
      });
      L.push("- **" + g.dir + "/** — " + g.label + " · " + plural(list.length, "repo") + ": " + list.map(function (p) { return "[" + p.repo + "](#" + p.id + ")"; }).join(", "));
    });
    L.push("");
    L.push("## Language mix");
    L.push("");
    langRows().forEach(function (r) {
      L.push("- " + r.lang + " — " + plural(r.n, "repo") + ", " + kb(r.kb) + " (" + r.pct + "% of tracked bytes)");
    });
    L.push("");
    L.push("## Last activity");
    L.push("");
    sorted("pushed").slice(0, 8).forEach(function (p) {
      L.push("- `" + p.pushed + "` — [" + p.repo + "](#" + p.id + ") · " + p.title);
    });
    L.push("");
    L.push("## Shortcuts");
    L.push("");
    L.push("- `⇧⇧` — Search everywhere");
    L.push("- `Alt` + `1` — toggle the project tree");
    L.push("- `Alt` + `F12` — toggle the terminal");
    L.push("- `Ctrl` + `E` / `Ctrl` + `Shift` + `V` — Editor / Preview");
    L.push("- terminal: `help`, `tree`, `ls`, `open <repo>`, `clone <repo>`, `stars`, `lang <name>`");
    L.push("");
    L.push("## Sources and credits");
    L.push("");
    L.push("- Repository metadata: GitHub REST API, captured 2026-11-06.");
    L.push("- Descriptions, stacks and excerpts: verified against each repository's own README, `pom.xml`, `package.json`, `pubspec.yaml`.");
    L.push("- Type: JetBrains Mono, SIL Open Font License.");
    L.push("- Icons: Material Design Icons, Apache-2.0.");
    L.push("- This page is static HTML, CSS and JavaScript — no framework, no build step.");
    L.push("");
    return L.join("\n");
  }

  function sorted(key) {
    return PROJECTS.slice().sort(function (a, b) {
      return a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0;
    });
  }

  function langRows() {
    var acc = {};
    PROJECTS.forEach(function (p) {
      acc[p.lang] = acc[p.lang] || { lang: p.lang, n: 0, kb: 0 };
      acc[p.lang].n++;
      acc[p.lang].kb += p.sizeKb;
    });
    var total = Object.keys(acc).reduce(function (a, k) {
      return a + acc[k].kb;
    }, 0);
    return Object.keys(acc)
      .map(function (k) {
        acc[k].pct = ((acc[k].kb / total) * 100).toFixed(1);
        return acc[k];
      })
      .sort(function (a, b) {
        return b.kb - a.kb;
      });
  }

  /* ------------------------------------------------------- markdown parser */
  var MD_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;

  // The whole line is escaped once up front, so captured pieces are already safe.
  function inlineMd(s, preview) {
    return esc(s).replace(MD_RE, function (m, code, bold, link) {
      if (code)
        return preview ? "<code>" + code.slice(1, -1) + "</code>" : '<span class="t-ic">' + code + "</span>";
      if (bold)
        return preview
          ? "<strong>" + bold.slice(2, -2) + "</strong>"
          : '<span class="t-fence">**</span><span class="t-bold">' + bold.slice(2, -2) + '</span><span class="t-fence">**</span>';
      var mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(m);
      var href = mm[2];
      var label = mm[1];
      var ext = /^https?:/.test(href.replace(/&amp;/g, "&"));
      var tgt = ext ? ' target="_blank" rel="noopener"' : ' class="hashlink"';
      if (preview) return '<a href="' + href + '"' + tgt + ">" + label + "</a>";
      return (
        '<span class="t-op">[</span><a class="t-link" href="' + href + '"' + tgt + ">" + label + "</a>" +
        '<span class="t-op">](</span><a class="t-url" href="' + href + '"' + tgt + ">" + href + "</a>" +
        '<span class="t-op">)</span>'
      );
    });
  }

  var CODE_HL = {
    sh: function (s) {
      if (/^\s*#/.test(s)) return '<span class="t-cmt">' + esc(s) + "</span>";
      return esc(s)
        .replace(/^(\s*)([\w./-]+)/, '$1<span class="t-fn">$2</span>')
        .replace(/(\s)(--?[\w-]+)/g, '$1<span class="t-attr">$2</span>')
        .replace(/(#[^<]*)$/, '<span class="t-cmt">$1</span>');
    },
    json: function (s) {
      return esc(s)
        .replace(/"[^"]*"\s*:/g, function (m) {
          return '<span class="t-key">' + m + "</span>";
        })
        .replace(/:\s*"[^"]*"/g, function (m) {
          return ': <span class="t-str">' + m.slice(2) + "</span>";
        })
        .replace(/("[^"]*"$)|("[^"]*",?$)/, function (m) {
          return '<span class="t-str">' + m + "</span>";
        })
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="t-num">$1</span>');
    },
    yaml: function (s) {
      if (/^\s*#/.test(s)) return '<span class="t-cmt">' + esc(s) + "</span>";
      var m = /^(\s*)([A-Za-z_][\w.-]*:)(.*)$/.exec(s);
      if (!m) return '<span class="t-op">' + esc(s) + "</span>";
      var val = m[3];
      var cmt = "";
      var c = /\s#\s/.exec(val);
      if (c) {
        cmt = '<span class="t-cmt">' + esc(val.slice(c.index)) + "</span>";
        val = val.slice(0, c.index);
      }
      var body = /^\s*$/.test(val) ? "" : '<span class="t-str">' + esc(val) + "</span>";
      if (/^\s*[-*]\s/.test(s)) return '<span class="t-bullet">' + esc(s) + "</span>" + cmt;
      return m[1] + '<span class="t-key">' + esc(m[2]) + "</span>" + body + cmt;
    },
    xml: function (s) {
      return esc(s).replace(/(&lt;\/?)([\w:.-]+)(\/?&gt;)/g, '$1<span class="t-tag">$2</span>$3');
    },
    latex: function (s) {
      return esc(s)
        .replace(/\\[a-zA-Z]+/g, function (m) {
          return '<span class="t-kw">' + m + "</span>";
        })
        .replace(/[{}]/g, '<span class="t-op">$&</span>');
    },
    markdown: function (s) {
      return inlineMd(s.replace(/^[-*]\s/, ""));
    },
  };

  function hlCode(s, lang) {
    var fn = CODE_HL[lang];
    return fn ? fn(s) : esc(s);
  }

  function highlight(text) {
    var lines = text.split("\n");
    var inFence = false;
    var fenceLang = "";
    var out = [];
    lines.forEach(function (ln, i) {
      var html;
      var cls = "";
      var fm = /^\s*```(\w*)/.exec(ln);
      if (fm) {
        inFence = !inFence;
        fenceLang = fm[1] || "text";
        html = '<span class="t-fence">' + esc(ln) + "</span>";
        cls = "is-fence";
      } else if (inFence) {
        html = hlCode(ln, fenceLang);
        cls = "is-code";
      } else if (/^#{1,6}\s/.test(ln)) {
        var hm = /^(#{1,6})(\s+)(.*)$/.exec(ln);
        html = '<span class="t-meta">' + hm[1] + "</span>" + hm[2] + '<span class="t-hd">' + esc(hm[3]) + "</span>";
        cls = "is-head" + (hm[1].length === 1 ? " is-h1" : "");
      } else if (/^\s*>/.test(ln)) {
        html = '<span class="t-fence">&gt; </span>' + inlineMd(ln.replace(/^\s*>\s?/, ""));
        cls = "is-quote";
      } else if (/^\s*[-*]\s/.test(ln)) {
        var bm = /^(\s*)([-*]\s)(.*)$/.exec(ln);
        html = bm[1] + '<span class="t-bullet">' + bm[2] + "</span>" + inlineMd(bm[3]);
        cls = "is-li";
      } else if (/^\s*\d+\.\s/.test(ln)) {
        var nm = /^(\s*)(\d+\.\s)(.*)$/.exec(ln);
        html = nm[1] + '<span class="t-num">' + nm[2] + "</span>" + inlineMd(nm[3]);
        cls = "is-li";
      } else if (/^\s*([-*_]){3,}\s*$/.test(ln)) {
        html = '<span class="t-fence">' + esc(ln) + "</span>";
      } else if (ln.trim() === "") {
        html = "";
        cls = "is-blank";
      } else {
        html = inlineMd(ln);
      }
      out.push({ n: i + 1, html: html, cls: cls });
    });
    return out;
  }

  var FENCE_NAME = { sh: "shell", json: "json", yaml: "yaml", xml: "pom.xml", latex: "latex", markdown: "markdown" };

  function renderMd(text, opts) {
    opts = opts || {};
    var hide = opts.hide || [];
    var lines = text.split("\n");
    var out = [];
    var i = 0;
    var skip = false;
    while (i < lines.length) {
      var ln = lines[i];

      if (/^##\s/.test(ln)) {
        var title = ln.replace(/^##\s+/, "");
        skip = hide.indexOf(title) >= 0;
        if (!skip) out.push('<h2 id="h-' + slug(title) + '">' + esc(title) + "</h2>");
        i++;
        continue;
      }
      if (/^#\s/.test(ln) || /^\s*$/.test(ln)) {
        i++;
        continue; // the h1 lives in the header, blanks are structure
      }
      if (/^###\s/.test(ln)) {
        if (!skip) out.push("<h3>" + esc(ln.replace(/^###\s+/, "")) + "</h3>");
        i++;
        continue;
      }
      if (/^\s*```/.test(ln)) {
        var lang = (/^\s*```(\w*)/.exec(ln) || [, ""])[1];
        var buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        if (!skip)
          out.push(
            '<pre><code><span class="cap">' +
              esc(FENCE_NAME[lang] || lang || "text") +
              "</span>" +
              buf
                .map(function (s) {
                  return hlCode(s, lang);
                })
                .join("\n") +
              "</code></pre>",
          );
        continue;
      }
      if (/^\s*>\s?/.test(ln)) {
        var q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
        if (skip) continue;
        var note = /still|no README|boilerplate|documents the opposite|only in the schema/i.test(q.join(" "));
        out.push(
          '<blockquote class="' + (note ? "note" : "") + '">' +
            q
              .map(function (s) {
                return inlineMd(s, true);
              })
              .join("<br>") +
            "</blockquote>",
        );
        continue;
      }
      if (/^\s*[-*]\s/.test(ln)) {
        var li = [];
        while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) li.push(lines[i++].replace(/^\s*[-*]\s/, ""));
        if (!skip)
          out.push(
            "<ul>" +
              li
                .map(function (s) {
                  return "<li>" + inlineMd(s, true) + "</li>";
                })
                .join("") +
              "</ul>",
          );
        continue;
      }
      var p = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^#/.test(lines[i]) && !/^\s*```/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]))
        p.push(lines[i++]);
      if (!skip) out.push("<p>" + inlineMd(p.join(" "), true) + "</p>");
    }
    return out.join("\n");
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /* ------------------------------------------------------------ previews */
  function factChips(p) {
    var g = groupOf(p.group);
    var c = [];
    c.push('<span class="chip">' + ic(langIcon(p.lang)) + "<b>" + esc(p.lang) + "</b></span>");
    c.push('<span class="chip">' + ic("folder") + esc(g ? g.dir : p.group) + "/</span>");
    c.push('<span class="chip">' + ic("source-branch") + esc(p.branch) + "</span>");
    c.push('<span class="chip">' + ic("clock-outline") + "pushed " + esc(p.pushed) + "</span>");
    c.push('<span class="chip">' + ic("memory") + kb(p.sizeKb) + "</span>");
    if (p.stars) c.push('<span class="chip">' + ic("star") + p.stars + " ★</span>");
    p.topics.forEach(function (t) {
      c.push('<span class="chip">' + ic("bookmark-outline") + esc(t) + "</span>");
    });
    return '<div class="chips">' + c.join("") + "</div>";
  }

  function statTiles(p) {
    var t = [
      ["language", langIcon(p.lang), p.lang],
      ["last push", "clock-outline", p.pushed, ago(p.pushed)],
      ["size", "memory", kb(p.sizeKb)],
      ["stars · forks", "star-outline", p.stars + " · " + p.forks],
      ["branch", "source-branch", p.branch],
      ["created", "calendar", p.created],
    ];
    return (
      '<div class="stats">' +
      t
        .map(function (r) {
          return (
            '<div class="stat"><div class="k">' + ic(r[1]) + esc(r[0]) + '</div><div class="v">' + esc(r[2]) +
            (r[3] ? " <small>" + esc(r[3]) + "</small>" : "") +
            "</div></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function actionRow(p) {
    return (
      '<div class="actions">' +
      '<a class="btn primary" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + ic("github", 16) + "Open on GitHub</a>" +
      '<a class="btn ghost" href="' + esc(p.readme) + '" target="_blank" rel="noopener">' + ic("file-document-outline", 16) + "Rendered README</a>" +
      '<button class="btn ghost" data-copy="' + esc(p.clone) + '">' + ic("content-copy", 16) + "Copy clone URL</button>" +
      '<button class="btn ghost" data-jump="' + esc(p.id) + '">' + ic("folder-open", 16) + "Reveal in tree</button>" +
      "</div>"
    );
  }

  function projectPreview(p) {
    return (
      '<div class="doc">' +
      '<h1>' + ic(p.icon, 24) + esc(p.title) + "</h1>" +
      '<div class="pathline">' + esc(p.path) + "/README.md · github.com/" + esc(OWNER.login) + "</div>" +
      factChips(p) +
      statTiles(p) +
      actionRow(p) +
      renderMd(projectMd(p), { hide: PROJECT_HIDE }) +
      "</div>"
    );
  }

  function workspacePreview() {
    var rows = langRows();
    var total = PROJECTS.reduce(function (a, p) {
      return a + p.sizeKb;
    }, 0);
    var stars = PROJECTS.reduce(function (a, p) {
      return a + p.stars;
    }, 0);

    var hero =
      '<div class="welcome">' +
      '<div class="hero">' +
      '<div class="pic">' +
      '<img src="' + OWNER.avatar + '" alt="" onerror="this.remove()">' +
      "BL</div>" +
      "<div><h1>Brahim Lakhal</h1>" +
      '<div class="sub">Android &amp; full-stack work in Kotlin, TypeScript and Java — ' +
      PROJECTS.length +
      " public repositories on <a href=\"" + OWNER.url + '" target="_blank" rel="noopener">github.com/' + esc(OWNER.login) + "</a>, " +
      'presented the way I live in them: one dark IDE workspace.</div>' +
      '<div class="chips" style="margin-top:12px">' +
      '<span class="chip">' + ic("github", 16) + "<b>" + esc(OWNER.login) + "</b></span>" +
      '<span class="chip">' + ic("folder-multiple-outline") + PROJECTS.length + " repos</span>" +
      '<span class="chip">' + ic("star") + stars + " stars</span>" +
      '<span class="chip">' + ic("calendar") + "on GitHub since " + esc(OWNER.since.slice(0, 4)) + "</span>" +
      '<span class="chip">' + ic("memory") + kb(total) + " tracked</span>" +
      "</div></div></div>";

    var bars =
      '<h2 style="margin-top:22px">Language mix</h2>' +
      '<div class="langbar">' +
      rows
        .map(function (r) {
          return '<i style="width:' + (r.kb / total) * 100 + "%;background:" + langColor(r.lang) + '"></i>';
        })
        .join("") +
      "</div>" +
      '<div class="legend">' +
      rows
        .map(function (r) {
          return "<span><b style=\"background:" + langColor(r.lang) + '"></b>' + esc(r.lang) + " · " + r.pct + "% · " + r.n + "</span>";
        })
        .join("") +
      "</div>";

    var groups = '<h2 style="margin-top:24px">Collections</h2>';
    GROUPS.forEach(function (g) {
      var list = PROJECTS.filter(function (p) {
        return p.group === g.id;
      });
      if (!list.length) return;
      groups +=
        '<h3 style="margin:14px 0 8px">' + ic(g.icon, 16) + " " + esc(g.dir) + "/ · " + esc(g.label) + "</h3>" +
        '<div class="card-grid">' +
        list.map(cardHtml).join("") +
        "</div>";
    });

    var timeline =
      '<h2 style="margin-top:26px">Recent activity</h2><div class="timeline">' +
      sorted("pushed")
        .slice(0, 10)
        .map(function (p) {
          return '<div class="tl" data-open="' + esc(p.id) + '">' + esc(p.repo) + '<span class="when">' + esc(p.pushed) + " · " + esc(ago(p.pushed)) + "</span></div>";
        })
        .join("") +
      "</div>";

    var shortcuts =
      '<h2 style="margin-top:26px">How to drive this page</h2><ul>' +
      ["<b>⇧ ⇧</b> or <b>Ctrl K</b> — Search everywhere", "<b>Alt 1</b> — project tree · <b>Alt F12</b> — terminal", "<b>Ctrl E</b> — editor source · <b>Ctrl Shift V</b> — rendered preview", "Every project tab is also linkable: <code>#kotlin-whatscraft</code>"].map(
        function (s) {
          return "<li>" + s + "</li>";
        },
      ).join("") +
      "</ul>";

    var about = renderMd(workspaceMd(), { hide: WORKSPACE_HIDE });

    return (
      '<div class="welcome">' +
      hero +
      '<div class="doc" style="max-width:1060px;padding:20px 0 0">' +
      bars +
      groups +
      '<hr>' +
      timeline +
      '<hr>' +
      about +
      "</div></div>"
    );
  }

  function cardHtml(p) {
    return (
      '<article class="pcard" data-open="' + esc(p.id) + '" tabindex="0">' +
      '<div class="ph">' +
      '<span style="color:' + langColor(p.lang) + '">' + ic(p.icon, 18) + "</span>" +
      '<span class="pname">' + esc(p.repo) + "</span></div>" +
      '<div class="pblurb">' + esc(p.tagline) + "</div>" +
      '<div class="pf"><span class="lang"><b style="width:8px;height:8px;border-radius:2px;display:inline-block;background:' +
      langColor(p.lang) +
      '"></b>' + esc(p.lang) + "</span><span class=\"grow\"></span>" +
      (p.stars ? ic("star") + p.stars + " " : "") +
      esc(ago(p.pushed)) +
      "</div></article>"
    );
  }

  /* -------------------------------------------------------------- render */
  var body = $("#body");
  var tabbar = $("#tabbar");
  var wrap = $("#editorWrap");
  var paneSrc = $("#paneSrc");
  var panePrev = $("#panePrev");
  var toolBody = $("#toolBody");
  var rightBody = $("#rightBody");

  function docFor(id) {
    if (id === "workspace") return { md: workspaceMd(), kind: "workspace" };
    var p = BY_ID[id];
    return p ? { md: projectMd(p), kind: "project", p: p } : docFor("workspace");
  }

  function renderTabs() {
    tabbar.innerHTML = state.tabs
      .map(function (id) {
        var m = tabMeta[id] || { title: id, icon: "file-code" };
        return (
          '<div class="tab' + (id === state.active ? " on" : "") + '" data-tab="' + esc(id) + '" role="tab">' +
          '<span style="color:' + (id === "workspace" ? "var(--accent-hi)" : langColor(BY_ID[id] ? BY_ID[id].lang : "")) + '">' + ic(m.icon, 16) + "</span>" +
          '<span class="tname">' + esc(m.title) + "</span>" +
          (state.tabs.length > 1 ? '<button class="tclose" data-close="' + esc(id) + '" title="Close">' + ic("close", 14) + "</button>" : "") +
          "</div>"
        );
      })
      .join("");
  }

  function renderCrumbs() {
    var id = state.active;
    var segs = [{ l: OWNER.login, i: "github" }];
    if (id !== "workspace") {
      var p = BY_ID[id];
      var g = groupOf(p.group);
      segs.push({ l: "portfolio", i: "folder" });
      segs.push({ l: g.dir, i: "folder" });
      segs.push({ l: p.repo, i: "folder-open" });
      segs.push({ l: "README.md", i: "file-document-outline" });
    } else {
      segs.push({ l: "workspace", i: "folder-text" });
    }
    $("#crumbs").innerHTML = segs
      .map(function (s, k) {
        return (
          (k ? '<span class="sep">' + ic("chevron-right", 14) + "</span>" : "") +
          '<button class="seg" data-crumb="' + esc(s.l) + '">' + ic(s.i, 14) + esc(s.l) + "</button>"
        );
      })
      .join("");
  }

  function renderEditor() {
    var d = docFor(state.active);
    var m = tabMeta[state.active];
    $("#gutterPath").innerHTML = ic("file-document-outline", 14) + " " + esc(m ? m.path : "") + " · Markdown";
    $("#gutterBadge").innerHTML =
      d.kind === "workspace"
        ? '<span class="chip">' + PROJECTS.length + " repos</span>"
        : '<span class="chip">' + d.md.split("\n").length + " lines</span>";

    var lines = highlight(d.md);
    paneSrc.innerHTML =
      '<div class="code">' +
      lines
        .map(function (l) {
          return (
            '<div class="line ' + l.cls + '" data-n="' + l.n + '"><span class="ln">' + l.n + "</span>" +
            '<span class="lc">' + (l.html || "&nbsp;") + "</span></div>"
          );
        })
        .join("") +
      "</div>";

    panePrev.innerHTML = d.kind === "workspace" ? workspacePreview() : projectPreview(d.p);

    wrap.className = "editor-wrap " + state.mode;
    paneSrc.hidden = state.mode === "preview";
    panePrev.hidden = state.mode === "code";
    Array.prototype.forEach.call(document.querySelectorAll("#modeSeg button"), function (b) {
      b.classList.toggle("on", b.dataset.mode === state.mode);
    });
    $("#panePrev").scrollTop = 0;
    $("#paneSrc").scrollTop = 0;

    // status bar widgets follow the open file
    var p = d.p;
    $("#stBranch").innerHTML = ic("source-branch", 14) + "<span>" + esc(p ? p.branch : "main") + "</span>";
    $("#stPos").textContent = "Ln 1, Col 1";
    var probs = PROJECTS.filter(function (x) {
      return x.caveat;
    }).length;
    $("#stCheck").className = "sbtn " + (probs ? "warn" : "ok");
    $("#stCheck").innerHTML =
      ic(probs ? "alert-circle-outline" : "check-circle-outline", 14) +
      "<span>" + (probs ? probs + " notes in Problems" : "No problems in workspace") + "</span>";
    renderRight();
  }

  function renderRight() {
    var d = docFor(state.active);
    var hide = hiddenSections(d.kind, state.mode);
    var heads = [];
    var skipping = false;
    d.md.split("\n").forEach(function (l) {
      if (/^##\s/.test(l)) {
        var t = l.replace(/^##\s+/, "");
        skipping = hide.indexOf(t) >= 0;
        if (!skipping) heads.push({ lv: 2, t: t });
      } else if (/^###\s/.test(l)) {
        if (!skipping) heads.push({ lv: 3, t: l.replace(/^###\s+/, "") });
      }
    });

    var out = "";
    out += '<div class="sec-label">' + (d.kind === "workspace" ? "Sections" : "File structure") + "</div>";
    out += heads
      .map(function (h) {
        return (
          '<div class="out-item lv' + h.lv + '" data-goto="' + esc(slug(h.t)) + '">' +
          ic(h.lv === 2 ? "format-title" : "chevron-right") + esc(h.t) + "</div>"
        );
      })
      .join("");

    if (d.p) {
      var p = d.p;
      out += '<div class="meta-block"><div class="sec-label" style="padding-left:0">Repository</div>';
      [
        ["owner", OWNER.login],
        ["name", p.repo],
        ["language", p.lang],
        ["branch", p.branch],
        ["created", p.created],
        ["last push", p.pushed],
        ["size", kb(p.sizeKb)],
        ["stars", String(p.stars)],
        ["forks", String(p.forks)],
        ["issues", String(p.issues)],
      ].forEach(function (r) {
        out += '<div class="meta-row"><span class="mk">' + esc(r[0]) + '</span><span class="mv">' + esc(r[1]) + "</span></div>";
      });
      out += "</div>";

      var g = groupOf(p.group);
      var share = Math.round((p.sizeKb / PROJECTS.reduce(function (a, x) { return a + x.sizeKb; }, 0)) * 100);
      out +=
        '<div class="meta-block"><div class="sec-label" style="padding-left:0">Weight in workspace</div>' +
        '<div class="bar"><i style="width:' + share + '%"></i></div>' +
        '<div class="meta-row"><span class="mk">share of bytes</span><span class="mv">' + share + "%</span></div>" +
        '<div class="meta-row"><span class="mk">collection</span><span class="mv">' + esc(g.dir) + "/</span></div></div>";
    } else {
      out +=
        '<div class="meta-block"><div class="sec-label" style="padding-left:0">Workspace</div>' +
        PROJECTS.length +
        " repositories · " +
        GROUPS.length +
        " collections</div>";
    }
    rightBody.innerHTML = out;
  }

  function treeHtml() {
    var q = state.filter.trim().toLowerCase();
    var hit = function (p) {
      if (!q) return true;
      return (
        p.repo.toLowerCase().indexOf(q) >= 0 ||
        p.title.toLowerCase().indexOf(q) >= 0 ||
        p.tagline.toLowerCase().indexOf(q) >= 0 ||
        p.lang.toLowerCase().indexOf(q) >= 0 ||
        p.stack.join(" ").toLowerCase().indexOf(q) >= 0
      );
    };
    var any = false;
    var html =
      '<div class="field">' +
      ic("magnify") +
      '<input id="treeFilter" placeholder="Filter files / repos  (Ctrl F)" value="' + esc(state.filter) + '" spellcheck="false">' +
      (state.filter ? '<button class="icon-btn" id="treeClear" title="Clear">' + ic("close", 14) + "</button>" : "") +
      "</div><div class=\"tree\">";

    GROUPS.forEach(function (g) {
      var list = PROJECTS.filter(function (p) {
        return p.group === g.id && hit(p);
      });
      if (!list.length) return;
      any = true;
      var open = q ? true : !state.collapsed[g.id];
      html +=
        '<div class="tnode dir" data-dir="' + esc(g.id) + '" style="padding-left:' + (6 + 0) + 'px">' +
        '<span class="tw">' + ic(open ? "chevron-down" : "chevron-right", 14) + "</span>" +
        ic(g.icon, 16) +
        '<span class="lbl">' + esc(g.dir) + "</span>" +
        '<span class="tail">' + list.length + "</span></div>";
      if (open) {
        html += '<div class="tlist">';
        list.forEach(function (p) {
          html +=
            '<div class="tnode' + (p.id === state.active ? " sel" : "") + '" data-open="' + esc(p.id) + '" title="' + esc(p.title) + '">' +
            '<span class="tw"></span>' +
            '<span class="ldot" style="background:' + langColor(p.lang) + '"></span>' +
            '<span class="lbl">' + esc(p.repo) + "</span>" +
            '<span class="tail">' + (p.stars ? ic("star", 12) + p.stars + " " : "") + kb(p.sizeKb) + "</span></div>";
        });
        html += "</div>";
      }
    });
    html += any ? "</div>" : '<div class="tree-empty">Nothing matches “' + esc(state.filter) + "”.</div></div>";
    return html;
  }

  function findHtml() {
    var q = state.filter.trim().toLowerCase();
    var rows = [];
    if (q) {
      PROJECTS.forEach(function (p) {
        projectMd(p)
          .split("\n")
          .forEach(function (ln, i) {
            if (ln.toLowerCase().indexOf(q) >= 0 && rows.length < 60) {
              rows.push({ p: p, n: i + 1, ln: ln });
            }
          });
      });
    }
    return (
      '<div class="field">' +
      ic("magnify") +
      '<input id="treeFilter" placeholder="Find in all manifests" value="' + esc(state.filter) + '" spellcheck="false"></div>' +
      (q
        ? rows.length
          ? '<div class="sec-label">' + rows.length + " occurrences of “" + esc(state.filter) + "”</div>" +
            rows
              .map(function (r) {
                var idx = r.ln.toLowerCase().indexOf(q);
                var before = esc(r.ln.slice(0, idx));
                var mid = esc(r.ln.slice(idx, idx + q.length));
                var after = esc(r.ln.slice(idx + q.length));
                return (
                  '<div class="row" data-open="' + esc(r.p.id) + '" data-line="' + r.n + '">' +
                  '<span class="ldot" style="width:8px;height:8px;border-radius:2px;margin-top:5px;background:' + langColor(r.p.lang) + '"></span>' +
                  '<span class="rgrow"><span class="rtitle">' + esc(r.p.repo) + " : " + r.n + "</span>" +
                  '<span class="rsub">' + before + "<mark>" + mid + "</mark>" + after + "</span></span></div>"
                );
              })
              .join("")
          : '<div class="tree-empty">No occurrence of “' + esc(state.filter) + "”.</div>"
        : '<div class="tree-empty">Type to search across every repository manifest, stack list and highlight.</div>')
    );
  }

  function gitHtml() {
    var out = '<div class="sec-label">Log — sorted by last push</div>';
    out +=
      '<div class="row" data-ext="' + OWNER.url + '"><span class="git-dot"></span><span class="rgrow">' +
      '<span class="rtitle">' + ic("source-branch", 14) + " origin/" + esc(sorted("pushed")[0].branch) + "</span>" +
      '<span class="rsub">' + esc(sorted("pushed")[0].repo) + " — " + esc(ago(sorted("pushed")[0].pushed)) + "</span></span></div>";
    sorted("pushed").forEach(function (p) {
      out +=
        '<div class="row" data-open="' + esc(p.id) + '">' +
        '<span class="git-dot"></span><span class="rgrow">' +
        '<span class="rtitle">' + esc(p.repo) + "</span>" +
        '<span class="rsub">' + esc(p.title) + "</span></span>" +
        '<span class="rdate">' + esc(p.pushed) + "</span></div>";
    });
    return out;
  }

  function starredHtml() {
    var withStars = PROJECTS.filter(function (p) {
      return p.stars > 0;
    });
    var big = sorted("sizeKb").slice(0, 6);
    var out = '<div class="sec-label">Starred — ' + withStars.length + " of " + PROJECTS.length + "</div>";
    out += withStars.length
      ? withStars
          .map(function (p) {
            return (
              '<div class="row" data-open="' + esc(p.id) + '">' +
              '<span style="color:var(--warn);margin-top:2px">' + ic("star", 16) + "</span>" +
              '<span class="rgrow"><span class="rtitle">' + esc(p.repo) + "</span>" +
              '<span class="rsub">' + esc(p.tagline) + "</span></span>" +
              '<span class="rdate">' + p.stars + " ★</span></div>"
            );
          })
          .join("")
      : '<div class="row"><span class="rgrow"><span class="rsub">No repository has stars yet — the work is here, the stars are up to you.</span></span></div>';
    out += '<div class="sec-label">Largest by tracked bytes</div>';
    out += big
      .map(function (p) {
        return (
          '<div class="row" data-open="' + esc(p.id) + '">' +
          '<span style="color:' + langColor(p.lang) + ';margin-top:2px">' + ic(langIcon(p.lang), 16) + "</span>" +
          '<span class="rgrow"><span class="rtitle">' + esc(p.repo) + "</span>" +
          '<span class="rsub">' + esc(p.lang) + " · " + esc(p.title) + "</span></span>" +
          '<span class="rdate">' + kb(p.sizeKb) + "</span></div>"
        );
      })
      .join("");
    return out;
  }

  function gridHtml() {
    var out = '<div class="sec-label">' + plural(PROJECTS.length, "repository", "repositories") + " in " + plural(GROUPS.length, "collection") + "</div>";
    GROUPS.forEach(function (g) {
      var list = PROJECTS.filter(function (p) {
        return p.group === g.id;
      });
      if (!list.length) return;
      out += '<div class="sec-label with-icon">' + ic(g.icon, 13) + esc(g.label) + "</div>";
      out += '<div class="card-grid">' + list.map(cardHtml).join("") + "</div>";
    });
    return out;
  }

  function aboutHtml() {
    var rows = langRows();
    var out = '<div class="sec-label">Profile</div>';
    out +=
      '<div class="row" data-ext="' + OWNER.url + '"><span class="rgrow"><span class="rtitle">' + ic("github", 16) + " " + esc(OWNER.login) + "</span>" +
      '<span class="rsub">' + PROJECTS.length + " repos · " + OWNER.followers + " followers · joined " + esc(OWNER.since.slice(0, 7)) + "</span></span></div>";
    out += '<div class="sec-label">This workspace</div>';
    [
      ["theme", "IntelliJ New UI Dark chrome"],
      ["syntax", "One Dark Pro palette"],
      ["font", "JetBrains Mono · SemiBold"],
      ["icons", "Material Design Icons 24×24"],
      ["build", "static HTML/CSS/JS"],
      ["data", "GitHub REST API 2026-11-06"],
    ].forEach(function (r) {
      out +=
        '<div class="row"><span class="rgrow"><span class="rtitle">' + esc(r[0]) + "</span>" +
        '<span class="rsub">' + esc(r[1]) + "</span></span></div>";
    });
    out += '<div class="sec-label">Languages</div>';
    rows.forEach(function (r) {
      out +=
        '<div class="row"><span class="rgrow"><span class="rtitle">' + esc(r.lang) + "</span>" +
        '<div class="bar"><i style="width:' + (r.kb / PROJECTS.reduce(function (a, p) { return a + p.sizeKb; }, 0)) * 100 + "%;background:" + langColor(r.lang) + '"></i></div>' +
        '<span class="rsub">' + plural(r.n, "repo") + " · " + kb(r.kb) + "</span></span></div>";
    });
    return out;
  }

  function renderTool() {
    var titles = { project: "Project", find: "Find in Files", git: "Git", starred: "Bookmarks", grid: "Repositories", about: "Workspace" };
    $("#toolTitle").textContent = titles[state.view] || "Project";
    var html = "";
    if (state.view === "project") html = treeHtml();
    else if (state.view === "find") html = findHtml();
    else if (state.view === "git") html = gitHtml();
    else if (state.view === "starred") html = starredHtml();
    else if (state.view === "grid") html = gridHtml();
    else html = aboutHtml();
    toolBody.innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll(".activity .abtn[data-view]"), function (b) {
      b.classList.toggle("on", b.dataset.view === state.view && state.tool);
    });
  }

  function renderStatus() {
    var last = sorted("pushed")[0];
    $("#stUpdated").innerHTML = ic("history", 14) + "<span class=\"hide-sm\">" + esc(ago(last.pushed)) + "</span>";
    $("#stUpdated").title = "Last push: " + last.repo + " on " + last.pushed;
    $("#stStars").innerHTML = ic("star-outline", 14) + "<span>" + PROJECTS.reduce(function (a, p) { return a + p.stars; }, 0) + "</span>";
    $("#stProjects").innerHTML = ic("folder-multiple-outline", 14) + "<span>" + PROJECTS.length + "</span>";
    $("#starBadge").textContent = PROJECTS.filter(function (p) { return p.stars > 0; }).length;
    $("#runCfgName").textContent = state.active === "workspace" ? "workspace" : BY_ID[state.active].repo;
  }

  function renderAll() {
    body.classList.toggle("tool-hidden", !state.tool);
    body.classList.toggle("right-hidden", !state.right);
    $("#bottom").classList.toggle("collapsed", !state.bottom);
    $("#hresizer").style.display = state.bottom ? "" : "none";
    $("#abTerm").classList.toggle("on", state.bottom);
    $("#abRight").classList.toggle("on", state.right);
    $("#btnSettings").classList.toggle("on", state.view === "about");
    renderTabs();
    renderCrumbs();
    renderTool();
    renderEditor();
    renderStatus();
    renderBottom();
    save();
  }

  /* ------------------------------------------------------------- actions */
  function openTab(id, line) {
    if (!tabMeta[id]) return;
    if (state.tabs.indexOf(id) < 0) state.tabs.push(id);
    state.active = id;
    if (id !== "workspace") location.hash = "#" + id;
    renderAll();
    if (line) {
      var el = paneSrc.querySelector('.line[data-n="' + line + '"]');
      if (el) {
        el.classList.add("cur");
        el.scrollIntoView({ block: "center" });
      }
    }
  }

  function closeTab(id) {
    var i = state.tabs.indexOf(id);
    if (i < 0) return;
    state.tabs.splice(i, 1);
    if (!state.tabs.length) state.tabs = ["workspace"];
    if (state.active === id) state.active = state.tabs[Math.max(0, i - 1)];
    renderAll();
  }

  function toggleView(v) {
    if (state.view === v && state.tool) state.tool = false;
    else {
      state.view = v;
      state.tool = true;
    }
    renderAll();
  }

  /* ------------------------------------------------------------ terminal */
  var termOut = $("#termOut");
  var termIn = $("#termIn");
  var CMD_HISTORY = [];
  var histIdx = -1;

  function tprint(text, cls) {
    state.term.push({ t: text, c: cls || "" });
    if (state.term.length > 400) state.term.shift();
  }

  function renderTerm() {
    termOut.innerHTML = state.term
      .map(function (l) {
        return '<div class="term-line ' + l.c + '">' + esc(l.t) + "</div>";
      })
      .join("");
    var host = $("#btTerm");
    host.scrollTop = host.scrollHeight;
  }

  function renderBottom() {
    renderTerm();
    renderProblems();
    renderNews();
  }

  function renderProblems() {
    var withCaveat = PROJECTS.filter(function (p) {
      return p.caveat;
    });
    var html = "";
    withCaveat.forEach(function (p) {
      html +=
        '<div class="row" data-open="' + esc(p.id) + '">' +
        '<span style="color:var(--warn);margin-top:1px">' + ic("alert-circle-outline", 16) + "</span>" +
        '<span class="rgrow"><span class="rtitle">warning: ' + esc(p.repo) + "</span>" +
        '<span class="rsub">' + esc(p.caveat) + "</span></span></div>";
    });
    html +=
      '<div class="row"><span style="color:var(--ok);margin-top:1px">' +
      ic("check-circle-outline", 16) +
      '</span><span class="rgrow"><span class="rtitle">Workspace resolves</span>' +
      "<span class=\"rsub\">" +
      PROJECTS.length +
      " repositories indexed, 0 errors, 0 unresolved references.</span></span></div>";
    $("#btProblems").innerHTML = html;
    $("#probCount").textContent = withCaveat.length ? " · " + withCaveat.length : "";
  }

  function renderNews() {
    $("#btNews").innerHTML =
      '<div class="sec-label">Pushed, newest first</div>' +
      sorted("pushed")
        .map(function (p) {
          return (
            '<div class="row" data-open="' + esc(p.id) + '">' +
            '<span class="git-dot"></span><span class="rgrow"><span class="rtitle">' + esc(p.repo) + "</span>" +
            '<span class="rsub">' + esc(p.title) + "</span></span>" +
            '<span class="rdate">' + esc(p.pushed) + "</span></div>"
          );
        })
        .join("");
  }

  function asciiTree() {
    var lines = ["brahimlakhal3/"];
    GROUPS.forEach(function (g, gi) {
      var list = PROJECTS.filter(function (p) {
        return p.group === g.id;
      });
      var lastG = gi === GROUPS.length - 1;
      lines.push((lastG ? "└── " : "├── ") + g.dir + "/");
      list.forEach(function (p, pi) {
        lines.push(
          (lastG ? "    " : "│   ") + (pi === list.length - 1 ? "└── " : "├── ") + p.repo + "/  (" + p.lang + ", " + kb(p.sizeKb) + ")",
        );
      });
    });
    return lines;
  }

  function runCmd(raw) {
    var input = raw.trim();
    tprint("brahimlakhal3@portfolio:~$ " + input, "cmd");
    if (!input) {
      renderTerm();
      return;
    }
    CMD_HISTORY.unshift(input);
    histIdx = -1;
    var sp = input.split(/\s+/);
    var c = sp[0].toLowerCase();
    var arg = sp.slice(1).join(" ");

    function findRepo(q) {
      var k = (q || "").toLowerCase().replace(/\/$/, "");
      if (!k) return null;
      return BY_REPO[k] || BY_REPO[k.replace(/^kotlin_|^server_/, "")] || PROJECTS.filter(function (p) { return p.id === k; })[0] || null;
    }

    if (c === "help") {
      [
        "help                       this list",
        "ls [group]                 collections, or the repos inside one",
        "tree                       the whole workspace as a directory tree",
        "open <repo>                open a repository in the editor",
        "clone <repo>               copy the git clone command",
        "url <repo>                 print the GitHub URL",
        "cat <repo>                 print tagline and highlights",
        "lang <name>                repositories written in a language",
        "stars                      ranked by stars",
        "search <text>              find text across every manifest",
        "clear                      empty the console",
        "exit                       hide the terminal panel",
      ].forEach(function (l) {
        tprint("  " + l, "mut");
      });
    } else if (c === "ls") {
      if (!arg) {
        GROUPS.forEach(function (g) {
          tprint(
            "  " + (g.dir + "/").padEnd(22) + g.label + "  — " + plural(PROJECTS.filter(function (p) { return p.group === g.id; }).length, "repo"),
            "ok",
          );
        });
      } else {
        var g2 = GROUPS.filter(function (g) {
          return g.id === arg.toLowerCase() || g.dir.toLowerCase() === arg.toLowerCase().replace(/\/$/, "");
        })[0];
        if (!g2) tprint("ls: no such collection: " + arg, "err");
        else
          PROJECTS.filter(function (p) {
            return p.group === g2.id;
          }).forEach(function (p) {
            tprint("  " + p.repo.padEnd(28) + p.lang.padEnd(18) + kb(p.sizeKb), "cmd");
          });
      }
    } else if (c === "tree") {
      asciiTree().forEach(function (l) {
        tprint(l, "echo");
      });
    } else if (c === "open") {
      var p1 = findRepo(arg);
      if (!p1) tprint("open: unknown repository: " + arg, "err");
      else {
        openTab(p1.id);
        tprint("→ opened " + p1.repo + " in the editor", "ok");
      }
    } else if (c === "clone") {
      var p2 = findRepo(arg);
      if (!p2) tprint("clone: unknown repository: " + arg, "err");
      else {
        tprint("$ git clone " + p2.clone, "echo");
        copyText("git clone " + p2.clone, function () {
          tprint("✓ command copied to clipboard", "ok");
          renderTerm();
        });
      }
    } else if (c === "url") {
      var p3 = findRepo(arg);
      tprint(p3 ? p3.url : "url: unknown repository: " + arg, p3 ? "echo" : "err");
    } else if (c === "cat") {
      var p4 = findRepo(arg);
      if (!p4) tprint("cat: unknown repository: " + arg, "err");
      else {
        tprint("# " + p4.repo + " — " + p4.title, "echo");
        tprint(p4.tagline, "mut");
        p4.highlights.forEach(function (h) {
          tprint("  • " + h, "cmd");
        });
      }
    } else if (c === "lang") {
      var l = arg.toLowerCase();
      var list = PROJECTS.filter(function (p) {
        return p.lang.toLowerCase() === l;
      });
      if (!list.length) tprint("no repository written in " + (arg || "?") + ". Try: " + langRows().map(function (r) { return r.lang; }).join(", "), "err");
      else
        list.forEach(function (p) {
          tprint("  " + p.repo.padEnd(28) + p.title, "cmd");
        });
    } else if (c === "stars") {
      PROJECTS.slice()
        .sort(function (a, b) {
          return b.stars - a.stars;
        })
        .forEach(function (p) {
          tprint("  " + String(p.stars).padStart(2) + " ★  " + p.repo, p.stars ? "ok" : "mut");
        });
    } else if (c === "search" || c === "grep") {
      if (!arg) tprint("usage: search <text>", "err");
      else {
        var n = 0;
        PROJECTS.forEach(function (p) {
          projectMd(p)
            .split("\n")
            .forEach(function (ln, i) {
              if (n < 15 && ln.toLowerCase().indexOf(arg.toLowerCase()) >= 0) {
                tprint("  " + p.repo + ":" + (i + 1) + ": " + ln.trim().slice(0, 110), "cmd");
                n++;
              }
            });
        });
        if (!n) tprint("no occurrence of " + arg, "err");
      }
    } else if (c === "clear") {
      state.term = [];
    } else if (c === "exit" || c === "q") {
      state.bottom = false;
      renderAll();
      return;
    } else if (c === "whoami") {
      tprint(OWNER.login + " — " + PROJECTS.length + " public repositories, joined " + OWNER.since.slice(0, 7) + ", " + OWNER.followers + " followers.", "echo");
      tprint(OWNER.url, "mut");
    } else if (c === "sudo") {
      tprint("nice try. this workspace is read-only for everyone except GitHub.", "err");
    } else {
      tprint("command not found: " + c + " — type help", "err");
    }
    renderTerm();
  }

  if (!state.term.length) {
    [
      { t: "JetBrains Runtime · workspace " + OWNER.login + " · " + PROJECTS.length + " repositories indexed", c: "mut" },
      { t: "$ tree", c: "cmd" },
    ].forEach(function (l) {
      state.term.push(l);
    });
    asciiTree().forEach(function (l) {
      state.term.push({ t: l, c: "echo" });
    });
    state.term.push({ t: "type `help` for commands — `open KOTLIN_WHATSCRAFT`, `clone`, `lang Kotlin`", c: "mut" });
  }

  /* ---------------------------------------------------- search everywhere */
  var scrim = $("#scrim");
  var qInput = $("#q");
  var results = $("#results");
  var palIdx = 0;
  var palItems = [];

  function paletteItems(q) {
    var items = [];
    var k = q.trim().toLowerCase();
    var match = function (s) {
      if (!k) return true;
      return s.toLowerCase().indexOf(k) >= 0;
    };
    PROJECTS.forEach(function (p) {
      var hay = [p.repo, p.title, p.tagline, p.lang, p.stack.join(" "), p.group].join(" ").toLowerCase();
      if (!k || hay.indexOf(k) >= 0 || k.split(" ").every(function (w) { return hay.indexOf(w) >= 0; })) {
        items.push({
          cat: "file",
          name: p.repo,
          sub: p.title + " · " + p.lang,
          icon: langIcon(p.lang),
          color: langColor(p.lang),
          run: function () {
            openTab(p.id);
          },
        });
      }
    });
    var actions = [
      { n: "Project tree", i: "folder", v: function () { state.view = "project"; state.tool = true; renderAll(); } },
      { n: "Find in files", i: "magnify", v: function () { state.view = "find"; state.tool = true; renderAll(); setTimeout(function () { var f = $("#treeFilter"); if (f) f.focus(); }, 0); } },
      { n: "Git log", i: "source-branch", v: function () { state.view = "git"; state.tool = true; renderAll(); } },
      { n: "Bookmarks & sizes", i: "star-outline", v: function () { state.view = "starred"; state.tool = true; renderAll(); } },
      { n: "Toggle terminal", i: "console-line", v: function () { state.bottom = !state.bottom; renderAll(); if (state.bottom) termIn.focus(); } },
      { n: "Toggle Structure panel", i: "format-list-bulleted-type", v: function () { state.right = !state.right; renderAll(); } },
      { n: "Show as Editor", i: "file-code", v: function () { state.mode = "code"; renderAll(); } },
      { n: "Show as Split", i: "view-grid", v: function () { state.mode = "split"; renderAll(); } },
      { n: "Show as Preview", i: "eye-outline", v: function () { state.mode = "preview"; renderAll(); } },
      { n: "Open github.com/brahimlakhal3", i: "github", v: function () { window.open(OWNER.url, "_blank", "noopener"); } },
      { n: "Reset workspace layout", i: "refresh", v: function () { try { localStorage.removeItem(LS); } catch (e) {} location.hash = ""; location.reload(); } },
    ];
    actions.forEach(function (a) {
      if (match(a.n))
        items.push({
          cat: "action",
          name: a.n,
          sub: "IDE action",
          icon: a.i,
          color: "var(--accent-hi)",
          run: a.v,
        });
    });
    GROUPS.forEach(function (g) {
      if (match(g.dir) || match(g.label))
        items.push({
          cat: "directory",
          name: g.dir + "/",
          sub: g.label + " — " + plural(PROJECTS.filter(function (p) { return p.group === g.id; }).length, "repo"),
          icon: g.icon,
          color: "var(--odp-yellow)",
          run: function () {
            state.filter = "";
            state.view = "project";
            state.tool = true;
            state.collapsed[g.id] = false;
            var first = PROJECTS.filter(function (p) { return p.group === g.id; })[0];
            if (first) openTab(first.id);
            else renderAll();
          },
        });
    });
    return items.slice(0, 40);
  }

  function paintPalette() {
    var q = qInput.value;
    palItems = paletteItems(q);
    palIdx = 0;
    results.innerHTML = palItems.length
      ? palItems
          .map(function (it, i) {
            var name = it.name;
            var k = q.trim();
            var html = esc(name);
            if (k) {
              var idx = name.toLowerCase().indexOf(k.toLowerCase());
              if (idx >= 0)
                html = esc(name.slice(0, idx)) + "<mark>" + esc(name.slice(idx, idx + k.length)) + "</mark>" + esc(name.slice(idx + k.length));
            }
            return (
              '<div class="res' + (i === 0 ? " on" : "") + '" data-i="' + i + '">' +
              '<span style="color:' + it.color + '">' + ic(it.icon, 18) + "</span>" +
              '<span class="rmain"><div class="rname">' + html + '</div><div class="rsub">' + esc(it.sub) + "</div></span>" +
              '<span class="rcat">' + it.cat + "</span></div>"
            );
          })
          .join("")
      : '<div class="tree-empty" style="padding:16px 12px">Nothing found. Try “kotlin”, “compose”, “api”, “latex”, “terminal”.</div>';
  }

  function openPalette() {
    scrim.hidden = false;
    qInput.value = "";
    paintPalette();
    qInput.focus();
  }
  function closePalette() {
    scrim.hidden = true;
  }
  function runPalette(i) {
    var it = palItems[i];
    closePalette();
    if (it) it.run();
  }

  /* ----------------------------------------------------------- shortcuts */
  var lastShift = 0;
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);

    if (!scrim.hidden) {
      if (e.key === "Escape") {
        closePalette();
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        palIdx = Math.min(palItems.length - 1, palIdx + 1);
        paintSel();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        palIdx = Math.max(0, palIdx - 1);
        paintSel();
        e.preventDefault();
      } else if (e.key === "Enter") {
        runPalette(palIdx);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "Shift") {
      var now = Date.now();
      if (now - lastShift < 420) {
        openPalette();
        e.preventDefault();
      }
      lastShift = now;
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      openPalette();
      e.preventDefault();
      return;
    }
    if (e.altKey && e.key === "1") {
      toggleView("project");
      e.preventDefault();
      return;
    }
    if (e.altKey && (e.key === "F12" || e.code === "F12")) {
      state.bottom = !state.bottom;
      renderAll();
      if (state.bottom) termIn.focus();
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v") {
      state.mode = "preview";
      renderAll();
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "e") {
      state.mode = "code";
      renderAll();
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && !typing) {
      state.view = "find";
      state.tool = true;
      renderAll();
      var f = $("#treeFilter");
      if (f) {
        f.focus();
        f.select();
      }
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      if (state.bottom) {
        state.bottom = false;
        renderAll();
      }
      return;
    }
    if (typing && document.activeElement === termIn) {
      if (e.key === "ArrowUp") {
        histIdx = Math.min(CMD_HISTORY.length - 1, histIdx + 1);
        if (CMD_HISTORY[histIdx] !== undefined) termIn.value = CMD_HISTORY[histIdx];
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        histIdx = Math.max(-1, histIdx - 1);
        termIn.value = histIdx < 0 ? "" : CMD_HISTORY[histIdx];
        e.preventDefault();
      }
    }
  });

  function paintSel() {
    Array.prototype.forEach.call(results.children, function (c, i) {
      c.classList.toggle("on", i === palIdx);
      if (i === palIdx) c.scrollIntoView({ block: "nearest" });
    });
  }
  qInput.addEventListener("input", paintPalette);
  results.addEventListener("click", function (e) {
    var r = e.target.closest(".res");
    if (r) runPalette(+r.dataset.i);
  });
  results.addEventListener("mousemove", function (e) {
    var r = e.target.closest(".res");
    if (r && +r.dataset.i !== palIdx) {
      palIdx = +r.dataset.i;
      paintSel();
    }
  });
  scrim.addEventListener("click", function (e) {
    if (e.target === scrim) closePalette();
  });
  $("#btnSearch").addEventListener("click", openPalette);
  $("#runCfg").addEventListener("click", function () {
    state.view = state.view === "about" ? "project" : "about";
    state.tool = true;
    renderAll();
  });
  $("#btnSettings").addEventListener("click", function () {
    state.view = "about";
    state.tool = true;
    renderAll();
  });
  function helpToast() {
    toast("⇧⇧ search everywhere · Alt+1 tree · Alt+F12 terminal · Ctrl+E editor · Ctrl+Shift+V preview");
  }
  $("#btnPaletteHelp").addEventListener("click", helpToast);
  $("#stHelp").addEventListener("click", helpToast);

  /* ------------------------------------------------------- delegated UI */
  $("#activity").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.view) toggleView(b.dataset.view);
    else if (b.id === "abTerm") {
      state.bottom = !state.bottom;
      renderAll();
      if (state.bottom) termIn.focus();
    } else if (b.id === "abRight") {
      state.right = !state.right;
      renderAll();
    }
  });

  document.addEventListener("click", function (e) {
    var t = e.target;

    var hash = t.closest('a[href^="#"]');
    if (hash) {
      var hid = hash.getAttribute("href").slice(1);
      if (BY_ID[hid]) {
        e.preventDefault();
        openTab(hid);
        return;
      }
    }

    var tab = t.closest(".tab");
    if (tab && !t.closest(".tclose")) {
      state.active = tab.dataset.tab;
      openTab(tab.dataset.tab);
      return;
    }
    var cl = t.closest("[data-close]");
    if (cl) {
      closeTab(cl.dataset.close);
      return;
    }
    var open = t.closest("[data-open]");
    if (open) {
      openTab(open.dataset.open, +open.dataset.line || 0);
      return;
    }
    var dir = t.closest("[data-dir]");
    if (dir) {
      state.collapsed[dir.dataset.dir] = !state.collapsed[dir.dataset.dir];
      renderTool();
      return;
    }
    var ext = t.closest("[data-ext]");
    if (ext) {
      window.open(ext.dataset.ext, "_blank", "noopener");
      return;
    }
    var jump = t.closest("[data-jump]");
    if (jump) {
      state.view = "project";
      state.tool = true;
      state.collapsed[BY_ID[jump.dataset.jump].group] = false;
      renderAll();
      var el = toolBody.querySelector('[data-open="' + jump.dataset.jump + '"]');
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.style.background = "var(--selection)";
      }
      return;
    }
    var cp = t.closest("[data-copy]");
    if (cp) {
      copyText(cp.dataset.copy, function () {
        toast("Copied: " + cp.dataset.copy.slice(0, 60));
      });
      return;
    }
    var gotoEl = t.closest("[data-goto]");
    if (gotoEl) {
      var id = gotoEl.dataset.goto;
      if (state.mode === "code") {
        var srcLines = docFor(state.active).md.split("\n");
        for (var li = 0; li < srcLines.length; li++) {
          if (/^#{2,3}\s/.test(srcLines[li]) && slug(srcLines[li].replace(/^#+\s+/, "")) === id) {
            var target = paneSrc.querySelector('.line[data-n="' + (li + 1) + '"]');
            if (target) {
              Array.prototype.forEach.call(paneSrc.querySelectorAll(".line.cur"), function (c) {
                c.classList.remove("cur");
              });
              target.classList.add("cur");
              target.scrollIntoView({ block: "center" });
            }
            break;
          }
        }
      } else {
        var h = panePrev.querySelector("#h-" + id);
        if (h) {
          h.scrollIntoView({ block: "start" });
          h.style.color = "var(--accent-hi)";
          setTimeout(function () {
            h.style.color = "";
          }, 900);
        }
      }
      Array.prototype.forEach.call(rightBody.querySelectorAll(".out-item"), function (o) {
        o.classList.toggle("on", o === gotoEl);
      });
      return;
    }
    var crumb = t.closest("[data-crumb]");
    if (crumb) {
      if (crumb.dataset.crumb === OWNER.login) window.open(OWNER.url, "_blank", "noopener");
      else if (crumb.dataset.crumb === "workspace" || crumb.dataset.crumb === "portfolio") openTab("workspace");
      return;
    }
    var mode = t.closest("#modeSeg button");
    if (mode) {
      state.mode = mode.dataset.mode;
      renderAll();
      return;
    }
    var bt = t.closest("[data-bt]");
    if (bt) {
      Array.prototype.forEach.call(document.querySelectorAll(".bt-tabs [data-bt]"), function (b) {
        b.classList.toggle("on", b === bt);
      });
      $("#btTerm").hidden = bt.dataset.bt !== "term";
      $("#btProblems").hidden = bt.dataset.bt !== "problems";
      $("#btNews").hidden = bt.dataset.bt !== "news";
      if (bt.dataset.bt === "term") renderTerm();
      return;
    }
    if (t.closest("#btHide")) {
      state.bottom = false;
      renderAll();
      return;
    }
    if (t.closest("#btClear")) {
      state.term = [];
      renderTerm();
      return;
    }
    if (t.closest("#toolCollapse")) {
      state.tool = false;
      renderAll();
      return;
    }
    if (t.closest("#rightCollapse")) {
      state.right = false;
      renderAll();
      return;
    }
  });

  // keyboard access for project cards
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("pcard")) {
      openTab(e.target.dataset.open);
    }
  });

  toolBody.addEventListener("input", function (e) {
    if (e.target.id === "treeFilter") {
      state.filter = e.target.value;
      var pos = e.target.selectionStart;
      renderTool();
      var nf = $("#treeFilter");
      if (nf) {
        nf.focus();
        try {
          nf.setSelectionRange(pos, pos);
        } catch (err) {}
      }
    }
  });
  toolBody.addEventListener("click", function (e) {
    if (e.target.closest("#treeClear")) {
      state.filter = "";
      renderTool();
      $("#treeFilter").focus();
    }
  });
  toolBody.addEventListener("keydown", function (e) {
    if (e.target.id === "treeFilter" && e.key === "Enter") {
      var first = toolBody.querySelector('[data-open]');
      if (first) openTab(first.dataset.open);
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.open) {
      e.preventDefault();
      openTab(e.target.dataset.open);
    }
  });

  termIn.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      runCmd(termIn.value);
      termIn.value = "";
    }
    e.stopPropagation();
  });

  // caret position widget
  paneSrc.addEventListener("click", function (e) {
    var line = e.target.closest(".line");
    if (!line) return;
    Array.prototype.forEach.call(paneSrc.querySelectorAll(".line.cur"), function (c) {
      c.classList.remove("cur");
    });
    line.classList.add("cur");
    var col = 1;
    var pos = null;
    if (document.caretRangeFromPoint) {
      var r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) pos = r.startContainer.textContent ? r.startOffset : null;
    } else if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (p) pos = p.offset;
    }
    if (typeof pos === "number") col = pos + 1;
    $("#stPos").textContent = "Ln " + line.dataset.n + ", Col " + col;
  });

  // horizontal drag between editor and terminal
  (function () {
    var dragging = false;
    var startY = 0;
    var win = $(".window");
    $("#hresizer").addEventListener("mousedown", function (e) {
      dragging = true;
      startY = e.clientY;
      win.dataset.bottomH = parseInt(getComputedStyle($("#bottom")).height, 10) || 210;
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var cur = parseInt(win.dataset.bottomH, 10);
      var next = Math.max(90, Math.min(window.innerHeight - 320, cur - (e.clientY - startY)));
      win.dataset.bottomH = next;
      $("#bottom").style.height = next + "px";
    });
    document.addEventListener("mouseup", function () {
      dragging = false;
    });
  })();

  /* --------------------------------------------------------------- boot */
  $("#avatar").innerHTML = '<img src="' + OWNER.avatar + '" alt="" onerror="this.remove()">BL';

  function hashId() {
    return decodeURIComponent((location.hash || "").replace(/^#?\/?/, "")).trim();
  }

  window.addEventListener("hashchange", function () {
    var id = hashId();
    if (BY_ID[id] && id !== state.active) openTab(id);
  });

  var start = hashId();
  if (BY_ID[start]) {
    if (state.tabs.indexOf(start) < 0) state.tabs.push(start);
    state.active = start;
  }
  renderAll();
})();

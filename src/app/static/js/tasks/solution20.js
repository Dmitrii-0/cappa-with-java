var colorSchemes = {
    'Python3.8':  'ace/mode/python',
    'GCC7.4':     'ace/mode/c_cpp',
    'Prolog-D':   'ace/mode/prolog',
    'PostgreSQL':  'ace/mode/pgsql',
    'Pascal':     'ace/mode/pascal',
    'Php':        'ace/mode/php',
    'CSharp':     'ace/mode/csharp',
    'Java':       'ace/mode/java',
    'Rust186':    'ace/mode/rust',
}

function initAce(container, code, mode) {
    container.textContent = code;
    var editor = ace.edit(container);
    editor.getSession().setMode(mode);
    editor.setOption("showPrintMargin", false);
    editor.setOption("maxLines", "Infinity");
    editor.setHighlightActiveLine(false);
    editor.setReadOnly(true);
}

var solutionPage = function(e) {
    document.querySelectorAll('.js__editor').forEach(function(elem) {
        var translator  = elem.getAttribute('data-translator'),
            colorScheme = colorSchemes[translator],
            aceDiv      = elem.querySelector('.js__editor-ace'),
            raw         = aceDiv.textContent.trim();

        if (raw.startsWith('CAPPA_PROJECT_V1')) {
            var jsonStr = raw.slice('CAPPA_PROJECT_V1'.length).trim();
            var project = JSON.parse(jsonStr);
            var files   = project.files;

            var tabsHtml = '<div class="solution-tabs">';
            files.forEach(function(f, i) {
                tabsHtml += '<button class="solution-tab' + (i === 0 ? ' active' : '') + '"'
                          + ' data-index="' + i + '">' + f.name + '</button>';
            });
            tabsHtml += '</div>';

            var editorsHtml = '';
            files.forEach(function(f, i) {
                editorsHtml += '<div class="solution-editor' + (i === 0 ? '' : ' hidden') + '"'
                             + ' data-index="' + i + '"></div>';
            });

            aceDiv.innerHTML = tabsHtml + editorsHtml;

            var editorDivs = aceDiv.querySelectorAll('.solution-editor');
            files.forEach(function(f, i) {
                initAce(editorDivs[i], f.content, colorScheme);
            });

            aceDiv.querySelectorAll('.solution-tab').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var idx = this.getAttribute('data-index');
                    aceDiv.querySelectorAll('.solution-tab')
                          .forEach(function(b) { b.classList.remove('active'); });
                    aceDiv.querySelectorAll('.solution-editor')
                          .forEach(function(d) { d.classList.add('hidden'); });
                    this.classList.add('active');
                    aceDiv.querySelector('.solution-editor[data-index="' + idx + '"]')
                          .classList.remove('hidden');
                });
            });

        } else {
            initAce(aceDiv, raw, colorScheme);
        }
    });
}

window.addEventListener('solutionPageLoaded', solutionPage);


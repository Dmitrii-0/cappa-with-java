'use strict';

const JAVAPROJECTMARKER = 'CAPPA_PROJECT_V1\n';
const JAVACLASSRE = /(?:public\s+)?(?:final\s+|abstract\s+)?class\s+([A-Z][A-Za-z0-9_]*)/;
const JAVAPUBLICCLASSRE = /public\s+(?:final\s+|abstract\s+)?class\s+([A-Z][A-Za-z0-9_]*)/;
const JAVAMAXTABS = 10;
const JAVARENAMEDEBOUNCE = 400;
const JAVAAUTOSAVEINTERVAL = 180000;

class JavaEditor {

    errorMessages = {
        0: 'Нет соединения',
        403: 'Нет доступа',
        404: 'Не найдено',
        500: 'Ошибка сервера',
        502: 'Сервер недоступен',
    };

    constructor(form) {
        this.form = form;
        this.translator = 'Java';
        this.translatorId = 'java';
        this.readonly = form.dataset.readonly === 'true';
        this.taskId = form.dataset.taskId;
        this.taskitemId = form.dataset.taskitemId;
        const raw = form.querySelector('textarea.js__editor-content[name=content]').value;
        this.tabs = [];
        this.activeTabId = null;
        this.loadTabs(raw);
        this.initAce();
        this.bindEvents();
        this.updateButtons();
        this.lastSavedDraft = '';
        this.renderTabs();
        window.setInterval(() => this.autosaveTick(), JAVAAUTOSAVEINTERVAL);
    }

    loadTabs(raw) {
        if (raw && raw.startsWith(JAVAPROJECTMARKER)) {
            try {
                const data = JSON.parse(raw.slice(JAVAPROJECTMARKER.length));
                if (Array.isArray(data.files) && data.files.length > 0) {
                    this.tabs = data.files.map((f, i) => ({
                        id: f.id || ('tab' + (Date.now() + i)),
                        displayName: f.name.replace(/\.java$/, ''),
                        fileName: f.name,
                        content: f.content || '',
                        locked: f.name === 'Main.java',
                        autoNamed: true,
                    }));
                    this.activeTabId = this.tabs[0].id;
                    return;
                }
            } catch(e) {
                console.warn('JavaEditor: ошибка парсинга JSON проекта', e);
            }
        }
        // single-file или пустой
        const firstId = 'tab' + Date.now() + '0';
        this.tabs = [{
            id: firstId,
            displayName: 'Main',
            fileName: 'Main.java',
            content: raw || '',
            locked: true,
            autoNamed: true,
        }];
        this.activeTabId = firstId;
    }

    initAce() {
        // ACE-редактор
        ace.config.set('basePath', '/static/js/ace-1.4.7/');
        const container = this.form.querySelector('.js__java-ace');
        this.ace = ace.edit(container);
        this.ace.setOption('showPrintMargin', false);
        this.ace.setOption('maxLines', 'Infinity');
        this.ace.setHighlightActiveLine(false);
        this.ace.setReadOnly(this.readonly);
        this.ace.getSession().setMode('ace/mode/java');

        const active = this.getActiveTab();
        this.ace.setValue(active ? active.content : '', -1);

        let renameTimer = null;
        this.ace.addEventListener('change', () => {
            const tab = this.getActiveTab();
            if (!tab) return;
            tab.content = this.ace.getValue();
            this.updateButtons();
            if (!tab.locked) {
                clearTimeout(renameTimer);
                renameTimer = setTimeout(() => this.tryAutoRename(tab), JAVARENAMEDEBOUNCE);
            }
            this.renderTabs();
        });
    }

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId) || null;
    }

    addTab() {
        if (this.tabs.length >= JAVAMAXTABS) return;
        const idx = this.tabs.length;
        const tab = {
            id: 'tab' + Date.now() + idx,
            displayName: 'File' + (idx + 1),
            fileName: 'File' + (idx + 1) + '.java',
            content: '',
            locked: false,
            autoNamed: false,
        };
        this.tabs.push(tab);
        this.switchTab(tab.id);
    }

    switchTab(id) {
        const cur = this.getActiveTab();
        if (cur) cur.content = this.ace.getValue();
        this.activeTabId = id;
        const tab = this.getActiveTab();
        if (tab) this.ace.setValue(tab.content, -1);
        this.renderTabs();
    }

    closeTab(id) {
        const tab = this.tabs.find(t => t.id === id);
        if (!tab || tab.locked) return;
        this.tabs = this.tabs.filter(t => t.id !== id);
        if (this.activeTabId === id) {
            this.activeTabId = this.tabs[0].id;
            this.ace.setValue(this.tabs[0].content, -1);
        }
        this.renderTabs();
    }

    tryAutoRename(tab) {
        const match = tab.content.match(JAVACLASSRE);
        if (!match) {
            tab.autoNamed = false;
            return;
        }
        const className = match[1];
        const duplicate = this.tabs.some(t => t.id !== tab.id && t.displayName === className);
        if (duplicate) return;
        tab.displayName = className;
        tab.fileName = className + '.java';
        tab.autoNamed = true;
        this.renderTabs();
    }

    renderTabs() {
        const container = this.form.querySelector('.js__java-tabs');
        if (!container) return;
        container.innerHTML = '';
        this.tabs.forEach(tab => {
            const isActive = tab.id === this.activeTabId;
            const el = document.createElement('div');
            el.className = 'js__java-tab' + (isActive ? ' js__java-tab--active' : '');
            el.addEventListener('click', () => this.switchTab(tab.id));

            const label = document.createElement('span');
            label.className = 'js__java-tab-label';
            label.textContent = tab.fileName;
            el.appendChild(label);

            if (!tab.locked) {
                const closeBtn = document.createElement('span');
                closeBtn.className = 'js__java-tab-close';
                closeBtn.textContent = '×';
                closeBtn.title = 'Закрыть';
                closeBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    this.closeTab(tab.id);
                });
                el.appendChild(closeBtn);
            }
            container.appendChild(el);
        });
    }

    syncToTextarea() {
        const cur = this.getActiveTab();
        if (cur) cur.content = this.ace.getValue();

        // Проверка: имя файла совпадает с public class
        for (const tab of this.tabs) {
            const m = tab.content.match(JAVAPUBLICCLASSRE);
            if (m && m[1] !== tab.displayName) {
                editorShowMessage(this, `${tab.fileName}: public class ${m[1]} не совпадает с именем файла. Исправьте перед отправкой.`);
                return false;
            }
        }
        const project = {
            files: this.tabs.map(t => ({ id: t.id, name: t.fileName, content: t.content }))
        };
        const serialized = JAVAPROJECTMARKER + JSON.stringify(project);
        this.form.querySelector('textarea.js__editor-content[name=content]').value = serialized;
        return true;
    }

    serializeRaw() {
        const cur = this.getActiveTab();
        if (cur) cur.content = this.ace.getValue();
        return JAVAPROJECTMARKER + JSON.stringify({
            files: this.tabs.map(t => ({ id: t.id, name: t.fileName, content: t.content }))
        });
    }

    hasContent() {
        return this.tabs.some(t => t.content.trim() !== '');
    }

    updateButtons() {
        if (this.hasContent()) {
            editorEnableButtons(this);
        } else {
            editorDisableButtons(this);
        }
    }

    autosaveTick() {
        const serialized = this.serializeRaw();
        if (serialized !== this.lastSavedDraft) {
            this.lastSavedDraft = serialized;
            this.form.querySelector('textarea.js__editor-content[name=content]').value = serialized;
            this.saveDraft();
        }
    }

    bindEvents() {
        const inputField = this.form.querySelector('.js__editor.js__input');
        if (inputField) editorInitField(this, inputField);

        const btn = (sel, fn) => {
            const el = this.form.querySelector(sel);
            if (el) el.addEventListener('click', fn);
        };
        btn('.js__editor-btn-debug', () => this.debug());
        btn('.js__editor-btn-tests', () => this.testing());
        btn('.js__editor-btn-save', () => this.saveDraft());
        btn('.js__editor-btn-ready', () => this.createSolution());
        btn('.js__java-tab-add', () => this.addTab());

        this.updateButtons();
    }

    debug() {
        if (!this.syncToTextarea()) return;
        const content = this.form.querySelector('textarea.js__editor-content[name=content]').value;
        if (!content) return;
        const inputTextarea = this.form.querySelector('textarea.js__editor-content[name=input]');
        const input = inputTextarea ? inputTextarea.value : null;
        const that = this;
        editorShowLoader(that);
        editorDisableButtons(that);
        $.ajax({
            url: `/api/translators/${that.translatorId}/debug/`,
            type: 'POST',
            data: JSON.stringify({ code: content, data_in: input }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            headers: { Authorization: `Token ${window.authToken}` },
            statusCode: {
                200: (response) => {
                    editorShowMessage(that, '', 'success');
                    const outputEl = that.form.querySelector('.js__output');
                    const errorEl = that.form.querySelector('.js__error');
                    if (outputEl) {
                        outputEl.querySelector('.js__editor-content').textContent = response.result;
                        outputEl.style.display = response.result ? 'block' : 'none';
                    }
                    if (errorEl) {
                        errorEl.querySelector('.js__editor-content').textContent = response.error;
                        errorEl.style.display = response.error ? 'block' : 'none';
                    }
                    editorEnableButtons(that);
                }
            },
            error: (xhr) => editorShowRequestError(that, xhr),
        });
    }

    testing() {
        if (!this.syncToTextarea()) return;
        const content = this.form.querySelector('textarea.js__editor-content[name=content]').value;
        if (!content) return;
        const that = this;
        editorShowLoader(that);
        editorDisableButtons(that);
        $.ajax({
            url: `/api/tasks/taskitem/${that.translatorId}/${that.taskitemId}/testing/`,
            type: 'POST',
            data: JSON.stringify({ code: content }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            headers: { Authorization: `Token ${window.authToken}` },
            statusCode: {
                200: (response) => {
                    editorShowMessage(that, response.ok ? 'Тест пройден' : 'Тест не пройден', response.ok ? 'success' : 'warning');
                    const table = document.querySelector('.js__form-tests-table');
                    if (table) {
                        response.tests.forEach(test => {
                            const tr = table.querySelector(`.js__form-test-${test.id}`);
                            if (!tr) return;
                            tr.classList.remove('success', 'unluck');
                            tr.classList.add(test.ok ? 'success' : 'unluck');
                            let txt = '';
                            if (test.result && test.error) txt = test.result + test.error;
                            else if (test.result) txt = test.result;
                            else if (test.error) txt = test.error;
                            const pre = tr.querySelector('.js__form-test-result pre');
                            if (pre) pre.innerHTML = txt;
                        });
                        table.querySelectorAll('.js__form-test-result').forEach(el => el.classList.remove('hidden'));
                    }
                    editorEnableButtons(that);
                }
            },
            error: (xhr) => editorShowRequestError(that, xhr),
        });
    }

    createSolution() {
        if (!this.syncToTextarea()) return;
        const content = this.form.querySelector('textarea.js__editor-content[name=content]').value;
        if (!content) return;
        if (!confirm('Отправить решение?')) return;
        const that = this;
        editorShowLoader(that);
        editorDisableButtons(that);
        $.ajax({
            url: `/api/tasks/taskitem/${that.translatorId}/${that.taskitemId}/create-solution/`,
            type: 'POST',
            data: JSON.stringify({ code: content }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            headers: { Authorization: `Token ${window.authToken}` },
            statusCode: {
                200: () => {
                    editorShowMessage(that, 'Решение отправлено', 'success');
                    editorShowSolutionsLink();
                    editorEnableButtons(that);
                }
            },
            error: (xhr) => editorShowRequestError(that, xhr),
        });
    }

    saveDraft() {
        const content = this.form.querySelector('textarea.js__editor-content[name=content]').value;
        const that = this;
        editorShowLoader(that);
        editorDisableButtons(that);
        $.ajax({
            url: `/api/tasks/${that.taskId}/draft/`,
            type: 'POST',
            data: JSON.stringify({ content: content, translator: that.translator }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            headers: { Authorization: `Token ${window.authToken}` },
            statusCode: {
                200: () => {
                    editorShowMessage(that, 'Черновик сохранён', 'success');
                    editorEnableButtons(that);
                }
            },
            error: (xhr) => editorShowRequestError(that, xhr),
        });
    }
}

window.JavaEditor = JavaEditor;

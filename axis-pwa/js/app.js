(function () {
  const Storage = window.AxisStorage;
  const Icons = window.AxisIcons;
  const { todayISO } = window.AxisDateUtils;

  const AppState = {
    route: 'dashboard',
    taskTimeFilter: 'todas',
    taskStatusFilter: 'todas',
    taskPriorityFilter: 'todas',
    courseStatusFilter: 'todos',
    careerStatusFilter: 'todos',
    projectStatusFilter: 'todos',
    noteSearch: '',
    noteCategoryFilter: 'todas',
    deferredInstallPrompt: null,
    waitingWorker: null
  };

  const ROUTE_TITLES = {
    dashboard: 'Visão Geral',
    tasks: 'Tarefas',
    courses: 'Estudos & Cursos',
    career: 'Carreira & Vagas',
    projects: 'Projetos Pessoais',
    goals: 'Metas Pessoais',
    notes: 'Bloco de Notas'
  };

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateBR(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 200ms ease';
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  function updateClockAndDate() {
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) dateEl.textContent = dateFormatter.format(now);

    const clockEl = document.getElementById('digital-clock');
    const { showClock } = Storage.getState().settings;
    if (clockEl) {
      clockEl.classList.toggle('hidden', !showClock);
      clockEl.textContent = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }

  function updateBadges() {
    const s = Storage.getState();
    const pendingTasks = s.tasks.filter((t) => !t.completed).length;
    const activeCourses = s.courses.filter((c) => c.status !== 'concluido').length;
    const activeJobs = s.career.filter((j) => !['aprovado', 'recusado'].includes(j.status)).length;
    const activeProjects = s.projects.filter((p) => p.status !== 'concluido').length;
    const activeGoals = s.goals.filter((g) => g.status !== 'concluida').length;

    const map = {
      'badge-tasks': pendingTasks,
      'badge-courses': activeCourses,
      'badge-career': activeJobs,
      'badge-projects': activeProjects,
      'badge-goals': activeGoals,
      'badge-notes': s.notes.length
    };

    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }

  function navigate(route) {
    if (!ROUTE_TITLES[route]) return;
    AppState.route = route;

    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });

    const mobileTitle = document.getElementById('mobile-page-title');
    if (mobileTitle) mobileTitle.textContent = ROUTE_TITLES[route];

    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function priorityBadge(priority) {
    const map = {
      alta: ['Alta', 'badge-danger'],
      media: ['Média', 'badge-warning'],
      baixa: ['Baixa', 'badge-neutral']
    };
    const [label, cls] = map[priority] || ['Média', 'badge-neutral'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function courseStatusBadge(status) {
    const map = {
      nao_iniciado: ['Não iniciado', 'badge-neutral'],
      em_andamento: ['Em andamento', 'badge-accent'],
      concluido: ['Concluído', 'badge-success']
    };
    const [label, cls] = map[status] || ['Em andamento', 'badge-accent'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function careerStatusBadge(status) {
    const map = {
      interesse: ['Interesse', 'badge-neutral'],
      enviada: ['Candidatura enviada', 'badge-info'],
      entrevista: ['Entrevista', 'badge-warning'],
      aprovado: ['Aprovado', 'badge-success'],
      recusado: ['Recusado', 'badge-danger']
    };
    const [label, cls] = map[status] || ['Interesse', 'badge-neutral'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function workModelLabel(model) {
    return { remoto: 'Remoto', hibrido: 'Híbrido', presencial: 'Presencial' }[model] || model;
  }

  function projectStatusBadge(status) {
    const map = {
      ideia: ['Ideia', 'badge-neutral'],
      em_desenvolvimento: ['Em desenvolvimento', 'badge-accent'],
      pausado: ['Pausado', 'badge-warning'],
      concluido: ['Concluído', 'badge-success']
    };
    const [label, cls] = map[status] || ['Em desenvolvimento', 'badge-accent'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function goalStatusBadge(status) {
    const map = {
      nao_iniciada: ['Não iniciada', 'badge-neutral'],
      em_andamento: ['Em andamento', 'badge-accent'],
      concluida: ['Concluída', 'badge-success']
    };
    const [label, cls] = map[status] || ['Em andamento', 'badge-accent'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function buildWeeklyProductivityHTML(tasks) {
    const days = [];
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const todayStr = todayISO();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const offset = d.getTimezoneOffset() * 60000;
      const iso = new Date(d.getTime() - offset).toISOString().slice(0, 10);
      const count = tasks.filter((t) => t.completed && t.completedAt && t.completedAt.slice(0, 10) === iso).length;
      days.push({
        iso,
        label: dayNames[d.getDay()],
        count,
        isToday: iso === todayStr
      });
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);
    const totalWeek = days.reduce((acc, d) => acc + d.count, 0);

    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.get('check-square', 17)} Produtividade Semanal</h3>
          <span class="badge badge-accent">${totalWeek} concluída(s) nos últimos 7 dias</span>
        </div>
        <div class="weekly-chart">
          ${days.map((d) => {
            const pct = d.count === 0 ? 6 : Math.round((d.count / maxCount) * 100);
            return `
              <div class="chart-col ${d.isToday ? 'today' : ''}">
                <span class="chart-count">${d.count}</span>
                <div class="chart-bar-area" title="${formatDateBR(d.iso)}: ${d.count} tarefa(s)">
                  <div class="chart-bar-fill" style="height: ${pct}%"></div>
                </div>
                <span class="chart-day">${d.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderDashboard() {
    const s = Storage.getState();
    const today = todayISO();

    const todayTasks = s.tasks.filter((t) => t.dueDate === today);
    const overdueTasks = s.tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today);
    const pendingTasks = s.tasks.filter((t) => !t.completed);

    const activeCourses = s.courses.filter((c) => c.status === 'em_andamento');
    const avgStudyProgress = s.courses.length
      ? Math.round(s.courses.reduce((acc, c) => acc + Number(c.progress || 0), 0) / s.courses.length)
      : 0;

    const activeGoals = s.goals.filter((g) => g.status !== 'concluida');
    const recentProjects = s.projects.slice(0, 3);

    const focusTasks = [
      ...overdueTasks,
      ...todayTasks.filter((t) => !t.completed),
      ...pendingTasks.filter((t) => t.dueDate !== today && (!t.dueDate || t.dueDate > today))
    ].slice(0, 5);

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">${getGreeting()}, ${escapeHTML(s.settings.userName)}</h1>
          <p class="page-subtitle">Resumo operacional do seu dia, estudos, carreira e metas em andamento.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" data-action="modal-task">
            ${Icons.get('plus', 16)} Nova Tarefa
          </button>
        </div>
      </div>

      <div class="shortcuts-bar">
        <button class="shortcut-chip" data-action="modal-task">${Icons.get('plus', 14)} Tarefa</button>
        <button class="shortcut-chip" data-action="modal-course">${Icons.get('book-open', 14)} Curso</button>
        <button class="shortcut-chip" data-action="modal-career">${Icons.get('briefcase', 14)} Candidatura</button>
        <button class="shortcut-chip" data-action="modal-project">${Icons.get('folder-git', 14)} Projeto</button>
        <button class="shortcut-chip" data-action="modal-goal">${Icons.get('target', 14)} Meta</button>
        <button class="shortcut-chip" data-action="modal-note">${Icons.get('file-text', 14)} Nota Rápida</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-top">
            <span>Tarefas Pendentes</span>
            ${Icons.get('check-square', 16)}
          </div>
          <div class="stat-value">${pendingTasks.length}</div>
          <div class="stat-foot">${todayTasks.length} para hoje · ${overdueTasks.length} atrasada(s)</div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <span>Progresso nos Estudos</span>
            ${Icons.get('book-open', 16)}
          </div>
          <div class="stat-value">${avgStudyProgress}%</div>
          <div class="stat-foot">${activeCourses.length} curso(s) em andamento</div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <span>Processos Seletivos</span>
            ${Icons.get('briefcase', 16)}
          </div>
          <div class="stat-value">${s.career.length}</div>
          <div class="stat-foot">${s.career.filter((j) => j.status === 'entrevista').length} em fase de entrevista</div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <span>Metas Ativas</span>
            ${Icons.get('target', 16)}
          </div>
          <div class="stat-value">${activeGoals.length}</div>
          <div class="stat-foot">${s.goals.filter((g) => g.status === 'concluida').length} concluída(s) no total</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${Icons.get('check-square', 17)} Foco & Tarefas Prioritárias</h3>
            <button class="btn btn-secondary btn-sm" data-route="tasks">Ver todas</button>
          </div>
          ${focusTasks.length === 0
            ? `<p class="page-subtitle">Nenhuma tarefa pendente no momento.</p>`
            : `<div class="task-list">
                ${focusTasks.map((t) => {
                  const isOverdue = !t.completed && t.dueDate && t.dueDate < today;
                  return `
                    <div class="task-item ${t.completed ? 'completed' : ''}">
                      <button class="checkbox-btn ${t.completed ? 'checked' : ''}" data-action="toggle-task" data-id="${t.id}" aria-label="Concluir tarefa">
                        ${Icons.get('check', 14)}
                      </button>
                      <div class="task-body">
                        <div class="task-title">${escapeHTML(t.title)}</div>
                        <div class="task-meta">
                          ${priorityBadge(t.priority)}
                          <span>${escapeHTML(t.category || 'Geral')}</span>
                          ${t.dueDate ? `<span class="${isOverdue ? 'badge badge-danger' : ''}">${isOverdue ? 'Atrasada: ' : ''}${formatDateBR(t.dueDate)}</span>` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>`
          }
        </div>

        ${buildWeeklyProductivityHTML(s.tasks)}
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${Icons.get('target', 17)} Metas em Andamento</h3>
            <button class="btn btn-secondary btn-sm" data-route="goals">Gerenciar</button>
          </div>
          ${activeGoals.length === 0
            ? `<p class="page-subtitle">Todas as metas cadastradas foram concluídas ou nenhuma meta foi criada.</p>`
            : `<div style="display:flex; flex-direction:column; gap:14px;">
                ${activeGoals.slice(0, 3).map((g) => `
                  <div class="progress-wrap">
                    <div class="progress-meta">
                      <strong style="color:var(--text-primary); font-weight:500;">${escapeHTML(g.title)}</strong>
                      <span>${g.progress}%</span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill ${g.progress === 100 ? 'complete' : ''}" style="width:${g.progress}%"></div>
                    </div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${Icons.get('book-open', 17)} Cursos em Andamento</h3>
            <button class="btn btn-secondary btn-sm" data-route="courses">Estudos</button>
          </div>
          ${activeCourses.length === 0
            ? `<p class="page-subtitle">Nenhum curso em andamento no momento.</p>`
            : `<div style="display:flex; flex-direction:column; gap:14px;">
                ${activeCourses.slice(0, 3).map((c) => `
                  <div class="progress-wrap">
                    <div class="progress-meta">
                      <strong style="color:var(--text-primary); font-weight:500;">${escapeHTML(c.name)}</strong>
                      <span>${c.progress}%</span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill" style="width:${c.progress}%"></div>
                    </div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.get('folder-git', 17)} Projetos Recentes</h3>
          <button class="btn btn-secondary btn-sm" data-route="projects">Todos os projetos</button>
        </div>
        ${recentProjects.length === 0
          ? `<p class="page-subtitle">Nenhum projeto pessoal cadastrado.</p>`
          : `<div class="cards-grid">
              ${recentProjects.map((p) => `
                <div class="card" style="background:var(--bg-elevated);">
                  <div class="card-header" style="margin-bottom:8px;">
                    <strong style="font-size:14px;">${escapeHTML(p.name)}</strong>
                    ${projectStatusBadge(p.status)}
                  </div>
                  <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">${escapeHTML(p.description || '')}</p>
                  <div class="progress-wrap">
                    <div class="progress-meta"><span>Progresso</span><span>${p.progress}%</span></div>
                    <div class="progress-track"><div class="progress-fill ${p.progress === 100 ? 'complete' : ''}" style="width:${p.progress}%"></div></div>
                  </div>
                </div>
              `).join('')}
            </div>`
        }
      </div>
    `;
  }

  function renderTasks() {
    const s = Storage.getState();
    const today = todayISO();

    const filtered = s.tasks.filter((t) => {
      if (AppState.taskTimeFilter === 'hoje' && t.dueDate !== today) return false;
      if (AppState.taskTimeFilter === 'atrasadas' && (t.completed || !t.dueDate || t.dueDate >= today)) return false;
      if (AppState.taskTimeFilter === 'futuras' && (!t.dueDate || t.dueDate <= today)) return false;

      if (AppState.taskStatusFilter === 'pendentes' && t.completed) return false;
      if (AppState.taskStatusFilter === 'concluidas' && !t.completed) return false;

      if (AppState.taskPriorityFilter !== 'todas' && t.priority !== AppState.taskPriorityFilter) return false;
      return true;
    });

    const totalFiltered = filtered.length;
    const completedFiltered = filtered.filter((t) => t.completed).length;
    const completionPct = totalFiltered ? Math.round((completedFiltered / totalFiltered) * 100) : 0;

    const counts = {
      todas: s.tasks.length,
      hoje: s.tasks.filter((t) => t.dueDate === today).length,
      atrasadas: s.tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today).length,
      futuras: s.tasks.filter((t) => t.dueDate && t.dueDate > today).length
    };

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Organização de Tarefas</h1>
          <p class="page-subtitle">Gerencie prazos, prioridades e acompanhe sua execução diária.</p>
        </div>
        <button class="btn btn-primary" data-action="modal-task">
          ${Icons.get('plus', 16)} Nova Tarefa
        </button>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="progress-wrap">
          <div class="progress-meta">
            <span>Progresso da visualização atual (${completedFiltered} de ${totalFiltered} concluídas)</span>
            <strong>${completionPct}%</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${completionPct === 100 && totalFiltered > 0 ? 'complete' : ''}" style="width:${completionPct}%"></div>
          </div>
        </div>
      </div>

      <div class="toolbar">
        <div class="tabs">
          <button class="tab-btn ${AppState.taskTimeFilter === 'todas' ? 'active' : ''}" data-filter-task-time="todas">Todas (${counts.todas})</button>
          <button class="tab-btn ${AppState.taskTimeFilter === 'hoje' ? 'active' : ''}" data-filter-task-time="hoje">Hoje (${counts.hoje})</button>
          <button class="tab-btn ${AppState.taskTimeFilter === 'atrasadas' ? 'active' : ''}" data-filter-task-time="atrasadas">Atrasadas (${counts.atrasadas})</button>
          <button class="tab-btn ${AppState.taskTimeFilter === 'futuras' ? 'active' : ''}" data-filter-task-time="futuras">Futuras (${counts.futuras})</button>
        </div>

        <div class="filters-group">
          <select class="select" id="filter-task-status" aria-label="Filtrar por status">
            <option value="todas" ${AppState.taskStatusFilter === 'todas' ? 'selected' : ''}>Status: Todos</option>
            <option value="pendentes" ${AppState.taskStatusFilter === 'pendentes' ? 'selected' : ''}>Pendentes</option>
            <option value="concluidas" ${AppState.taskStatusFilter === 'concluidas' ? 'selected' : ''}>Concluídas</option>
          </select>

          <select class="select" id="filter-task-priority" aria-label="Filtrar por prioridade">
            <option value="todas" ${AppState.taskPriorityFilter === 'todas' ? 'selected' : ''}>Prioridade: Todas</option>
            <option value="alta" ${AppState.taskPriorityFilter === 'alta' ? 'selected' : ''}>Alta</option>
            <option value="media" ${AppState.taskPriorityFilter === 'media' ? 'selected' : ''}>Média</option>
            <option value="baixa" ${AppState.taskPriorityFilter === 'baixa' ? 'selected' : ''}>Baixa</option>
          </select>
        </div>
      </div>

      ${filtered.length === 0
        ? `<div class="empty-state">
            ${Icons.get('check-square', 28)}
            <div class="empty-state-title">Nenhuma tarefa encontrada</div>
            <div class="empty-state-desc">Ajuste os filtros acima ou adicione uma nova tarefa.</div>
            <button class="btn btn-primary btn-sm" data-action="modal-task">Adicionar Tarefa</button>
          </div>`
        : `<div class="task-list">
            ${filtered.map((t) => {
              const isOverdue = !t.completed && t.dueDate && t.dueDate < today;
              return `
                <div class="task-item ${t.completed ? 'completed' : ''}">
                  <button class="checkbox-btn ${t.completed ? 'checked' : ''}" data-action="toggle-task" data-id="${t.id}" aria-label="Alternar conclusão">
                    ${Icons.get('check', 14)}
                  </button>
                  <div class="task-body">
                    <div class="task-title">${escapeHTML(t.title)}</div>
                    <div class="task-meta">
                      ${priorityBadge(t.priority)}
                      <span class="badge badge-neutral">${escapeHTML(t.category || 'Geral')}</span>
                      ${t.dueDate ? `<span class="${isOverdue ? 'badge badge-danger' : ''}">${Icons.get('calendar', 12)} ${formatDateBR(t.dueDate)}</span>` : '<span>Sem prazo</span>'}
                    </div>
                  </div>
                  <div class="item-actions">
                    <button class="icon-btn" data-action="edit-task" data-id="${t.id}" title="Editar">${Icons.get('edit', 15)}</button>
                    <button class="icon-btn danger" data-action="delete-task" data-id="${t.id}" title="Excluir">${Icons.get('trash', 15)}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>`
      }
    `;
  }

  function renderCourses() {
    const s = Storage.getState();
    const filtered = s.courses.filter((c) => {
      if (AppState.courseStatusFilter === 'todos') return true;
      return c.status === AppState.courseStatusFilter;
    });

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Estudos & Cursos</h1>
          <p class="page-subtitle">Acompanhe trilhas de aprendizado, porcentagens de conclusão e anotações.</p>
        </div>
        <button class="btn btn-primary" data-action="modal-course">
          ${Icons.get('plus', 16)} Cadastrar Curso
        </button>
      </div>

      <div class="toolbar">
        <div class="tabs">
          <button class="tab-btn ${AppState.courseStatusFilter === 'todos' ? 'active' : ''}" data-filter-course="todos">Todos (${s.courses.length})</button>
          <button class="tab-btn ${AppState.courseStatusFilter === 'em_andamento' ? 'active' : ''}" data-filter-course="em_andamento">Em andamento</button>
          <button class="tab-btn ${AppState.courseStatusFilter === 'nao_iniciado' ? 'active' : ''}" data-filter-course="nao_iniciado">Não iniciados</button>
          <button class="tab-btn ${AppState.courseStatusFilter === 'concluido' ? 'active' : ''}" data-filter-course="concluido">Concluídos</button>
        </div>
      </div>

      ${filtered.length === 0
        ? `<div class="empty-state">
            ${Icons.get('book-open', 28)}
            <div class="empty-state-title">Nenhum curso cadastrado neste filtro</div>
            <div class="empty-state-desc">Adicione cursos técnicos, formações ou módulos de estudo.</div>
            <button class="btn btn-primary btn-sm" data-action="modal-course">Cadastrar Curso</button>
          </div>`
        : `<div class="cards-grid">
            ${filtered.map((c) => `
              <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
                <div>
                  <div class="card-header" style="margin-bottom:8px;">
                    <span class="badge badge-neutral">${escapeHTML(c.category || 'Geral')}</span>
                    ${courseStatusBadge(c.status)}
                  </div>
                  <h3 style="font-size:16px; font-weight:600; margin-bottom:4px;">${escapeHTML(c.name)}</h3>
                  <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">Plataforma: ${escapeHTML(c.platform || 'Não informada')}</div>

                  <div class="progress-wrap" style="margin-bottom:12px;">
                    <div class="progress-meta">
                      <span>Progresso</span>
                      <strong>${c.progress}%</strong>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill ${c.progress === 100 ? 'complete' : ''}" style="width:${c.progress}%"></div>
                    </div>
                    <input type="range" min="0" max="100" step="5" value="${c.progress}" data-action="slide-course" data-id="${c.id}" aria-label="Ajustar progresso do curso" style="width:100%; accent-color:var(--accent); margin-top:4px; cursor:pointer;" />
                  </div>

                  <div style="font-size:12px; color:var(--text-muted); display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
                    <span>Início: ${formatDateBR(c.startDate)}</span>
                    ${c.endDate ? `<span>Conclusão: ${formatDateBR(c.endDate)}</span>` : ''}
                  </div>

                  ${c.notes ? `<p style="font-size:13px; color:var(--text-secondary); background:var(--bg-elevated); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">${escapeHTML(c.notes)}</p>` : ''}
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid var(--border-subtle);">
                  ${c.url
                    ? `<a href="${escapeHTML(c.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">${Icons.get('external-link', 14)} Acessar curso</a>`
                    : `<span style="font-size:12px; color:var(--text-muted);">Sem link externo</span>`
                  }
                  <div class="item-actions">
                    <button class="icon-btn" data-action="edit-course" data-id="${c.id}" title="Editar">${Icons.get('edit', 15)}</button>
                    <button class="icon-btn danger" data-action="delete-course" data-id="${c.id}" title="Excluir">${Icons.get('trash', 15)}</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>`
      }
    `;
  }

  function renderCareer() {
    const s = Storage.getState();
    const filtered = s.career.filter((j) => {
      if (AppState.careerStatusFilter === 'todos') return true;
      return j.status === AppState.careerStatusFilter;
    });

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Carreira & Candidaturas</h1>
          <p class="page-subtitle">Acompanhe vagas, etapas de processos seletivos e histórico de aplicações.</p>
        </div>
        <button class="btn btn-primary" data-action="modal-career">
          ${Icons.get('plus', 16)} Nova Candidatura
        </button>
      </div>

      <div class="toolbar">
        <div class="tabs">
          <button class="tab-btn ${AppState.careerStatusFilter === 'todos' ? 'active' : ''}" data-filter-career="todos">Todas (${s.career.length})</button>
          <button class="tab-btn ${AppState.careerStatusFilter === 'interesse' ? 'active' : ''}" data-filter-career="interesse">Interesse</button>
          <button class="tab-btn ${AppState.careerStatusFilter === 'enviada' ? 'active' : ''}" data-filter-career="enviada">Enviadas</button>
          <button class="tab-btn ${AppState.careerStatusFilter === 'entrevista' ? 'active' : ''}" data-filter-career="entrevista">Entrevistas</button>
          <button class="tab-btn ${AppState.careerStatusFilter === 'aprovado' ? 'active' : ''}" data-filter-career="aprovado">Aprovado</button>
          <button class="tab-btn ${AppState.careerStatusFilter === 'recusado' ? 'active' : ''}" data-filter-career="recusado">Recusado</button>
        </div>
      </div>

      ${filtered.length === 0
        ? `<div class="empty-state">
            ${Icons.get('briefcase', 28)}
            <div class="empty-state-title">Nenhuma candidatura encontrada</div>
            <div class="empty-state-desc">Registre vagas de interesse ou candidaturas enviadas para manter seu histórico organizado.</div>
            <button class="btn btn-primary btn-sm" data-action="modal-career">Registrar Vaga</button>
          </div>`
        : `<div class="cards-grid">
            ${filtered.map((j) => `
              <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
                <div>
                  <div class="card-header" style="margin-bottom:8px;">
                    <span class="badge badge-neutral">${workModelLabel(j.workModel)}</span>
                    ${careerStatusBadge(j.status)}
                  </div>
                  <h3 style="font-size:16px; font-weight:600; margin-bottom:2px;">${escapeHTML(j.role)}</h3>
                  <div style="font-size:14px; color:var(--accent); font-weight:500; margin-bottom:8px;">${escapeHTML(j.company)}</div>

                  <div style="font-size:12px; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:12px; margin-bottom:10px;">
                    <span>Local: ${escapeHTML(j.location || 'Não informado')}</span>
                    <span>Data: ${formatDateBR(j.appliedDate)}</span>
                  </div>

                  ${j.notes ? `<p style="font-size:13px; color:var(--text-secondary); background:var(--bg-elevated); padding:10px; border-radius:8px; border:1px solid var(--border-subtle); margin-bottom:10px;">${escapeHTML(j.notes)}</p>` : ''}

                  ${Array.isArray(j.history) && j.history.length > 0
                    ? `<div style="font-size:11px; color:var(--text-muted);">
                        <strong>Histórico:</strong>
                        ${j.history.slice(-3).map((h) => `${formatDateBR(h.date)} (${h.status})`).join(' → ')}
                      </div>`
                    : ''
                  }
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid var(--border-subtle);">
                  ${j.url
                    ? `<a href="${escapeHTML(j.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">${Icons.get('external-link', 14)} Link da vaga</a>`
                    : `<span style="font-size:12px; color:var(--text-muted);">Sem link salvo</span>`
                  }
                  <div class="item-actions">
                    <button class="icon-btn" data-action="edit-career" data-id="${j.id}" title="Editar">${Icons.get('edit', 15)}</button>
                    <button class="icon-btn danger" data-action="delete-career" data-id="${j.id}" title="Excluir">${Icons.get('trash', 15)}</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>`
      }
    `;
  }

  function renderProjects() {
    const s = Storage.getState();
    const filtered = s.projects.filter((p) => {
      if (AppState.projectStatusFilter === 'todos') return true;
      return p.status === AppState.projectStatusFilter;
    });

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Projetos Pessoais</h1>
          <p class="page-subtitle">Portfólio técnico de desenvolvimento, infraestrutura, redes e engenharia.</p>
        </div>
        <button class="btn btn-primary" data-action="modal-project">
          ${Icons.get('plus', 16)} Novo Projeto
        </button>
      </div>

      <div class="toolbar">
        <div class="tabs">
          <button class="tab-btn ${AppState.projectStatusFilter === 'todos' ? 'active' : ''}" data-filter-project="todos">Todos (${s.projects.length})</button>
          <button class="tab-btn ${AppState.projectStatusFilter === 'em_desenvolvimento' ? 'active' : ''}" data-filter-project="em_desenvolvimento">Em desenvolvimento</button>
          <button class="tab-btn ${AppState.projectStatusFilter === 'ideia' ? 'active' : ''}" data-filter-project="ideia">Ideias</button>
          <button class="tab-btn ${AppState.projectStatusFilter === 'pausado' ? 'active' : ''}" data-filter-project="pausado">Pausados</button>
          <button class="tab-btn ${AppState.projectStatusFilter === 'concluido' ? 'active' : ''}" data-filter-project="concluido">Concluídos</button>
        </div>
      </div>

      ${filtered.length === 0
        ? `<div class="empty-state">
            ${Icons.get('folder-git', 28)}
            <div class="empty-state-title">Nenhum projeto encontrado</div>
            <div class="empty-state-desc">Documente seus repositórios, arquiteturas e aplicações em construção.</div>
            <button class="btn btn-primary btn-sm" data-action="modal-project">Criar Projeto</button>
          </div>`
        : `<div class="cards-grid">
            ${filtered.map((p) => `
              <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
                <div>
                  <div class="card-header" style="margin-bottom:8px;">
                    <span style="font-size:12px; color:var(--text-muted);">Criado em ${formatDateBR(p.createdDate)}</span>
                    ${projectStatusBadge(p.status)}
                  </div>
                  <h3 style="font-size:16px; font-weight:600; margin-bottom:6px;">${escapeHTML(p.name)}</h3>
                  <p style="font-size:13.5px; color:var(--text-secondary); margin-bottom:12px;">${escapeHTML(p.description || '')}</p>

                  <div class="tech-tags" style="margin-bottom:14px;">
                    ${(p.technologies || []).map((tech) => `<span class="tech-tag">${escapeHTML(tech)}</span>`).join('')}
                  </div>

                  <div class="progress-wrap" style="margin-bottom:10px;">
                    <div class="progress-meta"><span>Evolução</span><strong>${p.progress}%</strong></div>
                    <div class="progress-track"><div class="progress-fill ${p.progress === 100 ? 'complete' : ''}" style="width:${p.progress}%"></div></div>
                  </div>

                  ${p.notes ? `<p style="font-size:12.5px; color:var(--text-muted);">${escapeHTML(p.notes)}</p>` : ''}
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:10px; border-top:1px solid var(--border-subtle);">
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${p.githubUrl ? `<a href="${escapeHTML(p.githubUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">${Icons.get('github', 14)} GitHub</a>` : ''}
                    ${p.demoUrl ? `<a href="${escapeHTML(p.demoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">${Icons.get('external-link', 14)} Demo</a>` : ''}
                  </div>
                  <div class="item-actions">
                    <button class="icon-btn" data-action="edit-project" data-id="${p.id}" title="Editar">${Icons.get('edit', 15)}</button>
                    <button class="icon-btn danger" data-action="delete-project" data-id="${p.id}" title="Excluir">${Icons.get('trash', 15)}</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>`
      }
    `;
  }

  function renderGoals() {
    const s = Storage.getState();

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Metas Pessoais</h1>
          <p class="page-subtitle">Divida objetivos de médio e longo prazo em etapas mensuráveis.</p>
        </div>
        <button class="btn btn-primary" data-action="modal-goal">
          ${Icons.get('plus', 16)} Nova Meta
        </button>
      </div>

      ${s.goals.length === 0
        ? `<div class="empty-state">
            ${Icons.get('target', 28)}
            <div class="empty-state-title">Nenhuma meta cadastrada</div>
            <div class="empty-state-desc">Defina metas com prazos e etapas práticas para acompanhar sua evolução.</div>
            <button class="btn btn-primary btn-sm" data-action="modal-goal">Criar Meta</button>
          </div>`
        : `<div class="cards-grid">
            ${s.goals.map((g) => `
              <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                <div>
                  <div class="card-header" style="margin-bottom:8px;">
                    <span class="badge badge-neutral">${escapeHTML(g.category || 'Geral')}</span>
                    ${goalStatusBadge(g.status)}
                  </div>
                  <h3 style="font-size:16px; font-weight:600; margin-bottom:4px;">${escapeHTML(g.title)}</h3>
                  ${g.description ? `<p style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;">${escapeHTML(g.description)}</p>` : ''}
                  <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Prazo: ${formatDateBR(g.deadline)}</div>

                  <div class="progress-wrap">
                    <div class="progress-meta"><span>Progresso geral</span><strong>${g.progress}%</strong></div>
                    <div class="progress-track"><div class="progress-fill ${g.progress === 100 ? 'complete' : ''}" style="width:${g.progress}%"></div></div>
                  </div>

                  <div class="steps-list">
                    <div style="font-size:12px; font-weight:600; color:var(--text-secondary);">Etapas (${(g.steps || []).filter((st) => st.done).length}/${(g.steps || []).length})</div>
                    ${(g.steps || []).map((st) => `
                      <div class="step-row ${st.done ? 'done' : ''}">
                        <button class="checkbox-btn ${st.done ? 'checked' : ''}" style="width:18px; height:18px;" data-action="toggle-goal-step" data-goal-id="${g.id}" data-step-id="${st.id}" aria-label="Marcar etapa">
                          ${Icons.get('check', 12)}
                        </button>
                        <span style="flex:1;">${escapeHTML(st.text)}</span>
                        <button class="icon-btn danger" style="width:24px; height:24px;" data-action="delete-goal-step" data-goal-id="${g.id}" data-step-id="${st.id}" title="Remover etapa">
                          ${Icons.get('x', 12)}
                        </button>
                      </div>
                    `).join('')}

                    <form class="inline-step-form" data-action="add-goal-step" data-goal-id="${g.id}">
                      <input type="text" class="input" name="stepText" placeholder="Nova etapa..." required />
                      <button type="submit" class="btn btn-secondary btn-sm">${Icons.get('plus', 14)}</button>
                    </form>
                  </div>
                </div>

                <div style="display:flex; justify-content:flex-end; padding-top:10px; border-top:1px solid var(--border-subtle);">
                  <div class="item-actions">
                    <button class="icon-btn" data-action="edit-goal" data-id="${g.id}" title="Editar">${Icons.get('edit', 15)}</button>
                    <button class="icon-btn danger" data-action="delete-goal" data-id="${g.id}" title="Excluir">${Icons.get('trash', 15)}</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>`
      }
    `;
  }

  function renderNotes() {
    const s = Storage.getState();
    const categories = ['todas', ...new Set(s.notes.map((n) => n.category).filter(Boolean))];
    const query = AppState.noteSearch.trim().toLowerCase();

    const filtered = s.notes
      .filter((n) => {
        if (AppState.noteCategoryFilter !== 'todas' && n.category !== AppState.noteCategoryFilter) return false;
        if (!query) return true;
        return (
          (n.title || '').toLowerCase().includes(query) ||
          (n.content || '').toLowerCase().includes(query) ||
          (n.category || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Bloco de Notas</h1>
          <p class="page-subtitle">Anotações rápidas, comandos, ideias técnicas e lembretes fixados.</p>
        </div>
        <button class="btn btn-primary" data-action="modal-note">
          ${Icons.get('plus', 16)} Nova Nota
        </button>
      </div>

      <div class="toolbar">
        <div class="filters-group" style="flex:1;">
          <input type="search" class="input" id="note-search-input" placeholder="Pesquisar por título, conteúdo ou categoria..." value="${escapeHTML(AppState.noteSearch)}" style="max-width:340px;" />
          <select class="select" id="note-category-select" aria-label="Filtrar categoria de nota">
            ${categories.map((cat) => `<option value="${escapeHTML(cat)}" ${AppState.noteCategoryFilter === cat ? 'selected' : ''}>${cat === 'todas' ? 'Categoria: Todas' : escapeHTML(cat)}</option>`).join('')}
          </select>
        </div>
      </div>

      ${filtered.length === 0
        ? `<div class="empty-state">
            ${Icons.get('file-text', 28)}
            <div class="empty-state-title">Nenhuma nota encontrada</div>
            <div class="empty-state-desc">Crie notas rápidas ou ajuste o termo de pesquisa.</div>
            <button class="btn btn-primary btn-sm" data-action="modal-note">Criar Nota</button>
          </div>`
        : `<div class="cards-grid">
            ${filtered.map((n) => `
              <div class="card note-card ${n.pinned ? 'pinned' : ''}">
                <div>
                  <div class="card-header" style="margin-bottom:10px;">
                    <span class="badge badge-neutral">${escapeHTML(n.category || 'Geral')}</span>
                    <button class="icon-btn ${n.pinned ? 'badge-accent' : ''}" data-action="toggle-pin-note" data-id="${n.id}" title="${n.pinned ? 'Desafixar nota' : 'Fixar nota'}">
                      ${Icons.get('pin', 14)}
                    </button>
                  </div>
                  <h3 style="font-size:15px; font-weight:600; margin-bottom:8px;">${escapeHTML(n.title)}</h3>
                  <div class="note-content">${escapeHTML(n.content)}</div>
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid var(--border-subtle);">
                  <span style="font-size:11px; color:var(--text-muted);">Atualizada em ${formatDateBR(n.updatedAt)}</span>
                  <div class="item-actions">
                    <button class="icon-btn" data-action="edit-note" data-id="${n.id}" title="Editar">${Icons.get('edit', 15)}</button>
                    <button class="icon-btn danger" data-action="delete-note" data-id="${n.id}" title="Excluir">${Icons.get('trash', 15)}</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>`
      }
    `;
  }

  function renderCurrentView() {
    const view = document.getElementById('app-view');
    if (!view) return;

    const renderers = {
      dashboard: renderDashboard,
      tasks: renderTasks,
      courses: renderCourses,
      career: renderCareer,
      projects: renderProjects,
      goals: renderGoals,
      notes: renderNotes
    };

    view.innerHTML = (renderers[AppState.route] || renderDashboard)();
    updateBadges();
  }

  function openModal(title, bodyHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-backdrop').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  }

  function openTaskModal(task = null) {
    openModal(task ? 'Editar Tarefa' : 'Nova Tarefa', `
      <form id="form-task">
        <input type="hidden" name="id" value="${task ? task.id : ''}" />
        <div class="form-group">
          <label class="form-label">Título da tarefa *</label>
          <input type="text" class="input" name="title" required value="${task ? escapeHTML(task.title) : ''}" placeholder="Ex: Implementar testes unitários" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <input type="text" class="input" name="category" value="${task ? escapeHTML(task.category) : 'Geral'}" placeholder="Estudos, Carreira, Projetos..." />
          </div>
          <div class="form-group">
            <label class="form-label">Prioridade</label>
            <select class="select" name="priority">
              <option value="baixa" ${task && task.priority === 'baixa' ? 'selected' : ''}>Baixa</option>
              <option value="media" ${!task || task.priority === 'media' ? 'selected' : ''}>Média</option>
              <option value="alta" ${task && task.priority === 'alta' ? 'selected' : ''}>Alta</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Prazo</label>
          <input type="date" class="input" name="dueDate" value="${task ? task.dueDate : todayISO()}" />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Tarefa</button>
        </div>
      </form>
    `);
  }

  function openCourseModal(course = null) {
    openModal(course ? 'Editar Curso' : 'Cadastrar Curso', `
      <form id="form-course">
        <input type="hidden" name="id" value="${course ? course.id : ''}" />
        <div class="form-group">
          <label class="form-label">Nome do curso *</label>
          <input type="text" class="input" name="name" required value="${course ? escapeHTML(course.name) : ''}" placeholder="Ex: Arquitetura de Redes e Linux" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Plataforma</label>
            <input type="text" class="input" name="platform" value="${course ? escapeHTML(course.platform) : ''}" placeholder="Udemy, Coursera, YouTube..." />
          </div>
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <input type="text" class="input" name="category" value="${course ? escapeHTML(course.category) : 'Tecnologia'}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="select" name="status">
              <option value="nao_iniciado" ${course && course.status === 'nao_iniciado' ? 'selected' : ''}>Não iniciado</option>
              <option value="em_andamento" ${!course || course.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
              <option value="concluido" ${course && course.status === 'concluido' ? 'selected' : ''}>Concluído</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Progresso (%)</label>
            <input type="number" class="input" name="progress" min="0" max="100" value="${course ? course.progress : 0}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Data de início</label>
            <input type="date" class="input" name="startDate" value="${course ? course.startDate : todayISO()}" />
          </div>
          <div class="form-group">
            <label class="form-label">Data de conclusão</label>
            <input type="date" class="input" name="endDate" value="${course ? course.endDate : ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Link de acesso</label>
          <input type="url" class="input" name="url" value="${course ? escapeHTML(course.url) : ''}" placeholder="https://..." />
        </div>
        <div class="form-group">
          <label class="form-label">Anotações</label>
          <textarea class="textarea" name="notes" rows="3">${course ? escapeHTML(course.notes) : ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Curso</button>
        </div>
      </form>
    `);
  }

  function openCareerModal(job = null) {
    openModal(job ? 'Editar Candidatura' : 'Nova Candidatura', `
      <form id="form-career">
        <input type="hidden" name="id" value="${job ? job.id : ''}" />
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Empresa *</label>
            <input type="text" class="input" name="company" required value="${job ? escapeHTML(job.company) : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Cargo / Vaga *</label>
            <input type="text" class="input" name="role" required value="${job ? escapeHTML(job.role) : ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Localização</label>
            <input type="text" class="input" name="location" value="${job ? escapeHTML(job.location) : ''}" placeholder="Ex: São Paulo - SP / Brasil" />
          </div>
          <div class="form-group">
            <label class="form-label">Modelo de trabalho</label>
            <select class="select" name="workModel">
              <option value="remoto" ${job && job.workModel === 'remoto' ? 'selected' : ''}>Remoto</option>
              <option value="hibrido" ${!job || job.workModel === 'hibrido' ? 'selected' : ''}>Híbrido</option>
              <option value="presencial" ${job && job.workModel === 'presencial' ? 'selected' : ''}>Presencial</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="select" name="status">
              <option value="interesse" ${job && job.status === 'interesse' ? 'selected' : ''}>Interesse</option>
              <option value="enviada" ${!job || job.status === 'enviada' ? 'selected' : ''}>Candidatura enviada</option>
              <option value="entrevista" ${job && job.status === 'entrevista' ? 'selected' : ''}>Entrevista</option>
              <option value="aprovado" ${job && job.status === 'aprovado' ? 'selected' : ''}>Aprovado</option>
              <option value="recusado" ${job && job.status === 'recusado' ? 'selected' : ''}>Recusado</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data da candidatura</label>
            <input type="date" class="input" name="appliedDate" value="${job ? job.appliedDate : todayISO()}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Link da vaga / portal</label>
          <input type="url" class="input" name="url" value="${job ? escapeHTML(job.url) : ''}" placeholder="https://..." />
        </div>
        <div class="form-group">
          <label class="form-label">Anotações</label>
          <textarea class="textarea" name="notes" rows="3">${job ? escapeHTML(job.notes) : ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Candidatura</button>
        </div>
      </form>
    `);
  }

  function openProjectModal(project = null) {
    openModal(project ? 'Editar Projeto' : 'Novo Projeto Pessoal', `
      <form id="form-project">
        <input type="hidden" name="id" value="${project ? project.id : ''}" />
        <div class="form-group">
          <label class="form-label">Nome do projeto *</label>
          <input type="text" class="input" name="name" required value="${project ? escapeHTML(project.name) : ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="textarea" name="description" rows="2">${project ? escapeHTML(project.description) : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Tecnologias utilizadas (separadas por vírgula)</label>
          <input type="text" class="input" name="technologies" value="${project ? escapeHTML((project.technologies || []).join(', ')) : ''}" placeholder="Python, Docker, Linux, JavaScript" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="select" name="status">
              <option value="ideia" ${project && project.status === 'ideia' ? 'selected' : ''}>Ideia</option>
              <option value="em_desenvolvimento" ${!project || project.status === 'em_desenvolvimento' ? 'selected' : ''}>Em desenvolvimento</option>
              <option value="pausado" ${project && project.status === 'pausado' ? 'selected' : ''}>Pausado</option>
              <option value="concluido" ${project && project.status === 'concluido' ? 'selected' : ''}>Concluído</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Progresso (%)</label>
            <input type="number" class="input" name="progress" min="0" max="100" value="${project ? project.progress : 10}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Link do GitHub</label>
            <input type="url" class="input" name="githubUrl" value="${project ? escapeHTML(project.githubUrl) : ''}" placeholder="https://github.com/..." />
          </div>
          <div class="form-group">
            <label class="form-label">Link de demonstração</label>
            <input type="url" class="input" name="demoUrl" value="${project ? escapeHTML(project.demoUrl) : ''}" placeholder="https://..." />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Data de criação</label>
            <input type="date" class="input" name="createdDate" value="${project ? project.createdDate : todayISO()}" />
          </div>
          <div class="form-group">
            <label class="form-label">Anotações técnicas</label>
            <input type="text" class="input" name="notes" value="${project ? escapeHTML(project.notes) : ''}" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Projeto</button>
        </div>
      </form>
    `);
  }

  function openGoalModal(goal = null) {
    openModal(goal ? 'Editar Meta' : 'Nova Meta Pessoal', `
      <form id="form-goal">
        <input type="hidden" name="id" value="${goal ? goal.id : ''}" />
        <div class="form-group">
          <label class="form-label">Título da meta *</label>
          <input type="text" class="input" name="title" required value="${goal ? escapeHTML(goal.title) : ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="textarea" name="description" rows="2">${goal ? escapeHTML(goal.description) : ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <input type="text" class="input" name="category" value="${goal ? escapeHTML(goal.category) : 'Carreira'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prazo</label>
            <input type="date" class="input" name="deadline" value="${goal ? goal.deadline : todayISO()}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="select" name="status">
              <option value="nao_iniciada" ${goal && goal.status === 'nao_iniciada' ? 'selected' : ''}>Não iniciada</option>
              <option value="em_andamento" ${!goal || goal.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
              <option value="concluida" ${goal && goal.status === 'concluida' ? 'selected' : ''}>Concluída</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Progresso manual (%)</label>
            <input type="number" class="input" name="progress" min="0" max="100" value="${goal ? goal.progress : 0}" />
          </div>
        </div>
        <p style="font-size:12px; color:var(--text-muted);">Dica: Após criar a meta, você poderá adicionar etapas diretamente no card para cálculo automático do progresso.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Meta</button>
        </div>
      </form>
    `);
  }

  function openNoteModal(note = null) {
    openModal(note ? 'Editar Nota' : 'Nova Nota Rápida', `
      <form id="form-note">
        <input type="hidden" name="id" value="${note ? note.id : ''}" />
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Título *</label>
            <input type="text" class="input" name="title" required value="${note ? escapeHTML(note.title) : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <input type="text" class="input" name="category" value="${note ? escapeHTML(note.category) : 'Geral'}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Conteúdo *</label>
          <textarea class="textarea" name="content" rows="6" required>${note ? escapeHTML(note.content) : ''}</textarea>
        </div>
        <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-secondary); cursor:pointer;">
          <input type="checkbox" name="pinned" ${note && note.pinned ? 'checked' : ''} style="accent-color:var(--accent);" />
          Fixar nota no topo
        </label>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Nota</button>
        </div>
      </form>
    `);
  }

  function openSettingsModal() {
    const s = Storage.getState();
    openModal('Backup, Dados & Configurações', `
      <form id="form-settings" class="form-group">
        <label class="form-label">Nome exibido na saudação</label>
        <div style="display:flex; gap:8px;">
          <input type="text" class="input" name="userName" value="${escapeHTML(s.settings.userName)}" required />
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>

      <div style="padding-top:14px; border-top:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:10px;">
        <strong style="font-size:14px;">Backup e Restauração (JSON)</strong>
        <p style="font-size:13px; color:var(--text-secondary);">Seus dados são salvos automaticamente neste navegador. Exporte um arquivo JSON regularmente para manter cópias de segurança ou transferir para outro aparelho.</p>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          <button type="button" class="btn btn-secondary" id="btn-export-json">
            ${Icons.get('download', 15)} Exportar Backup (.json)
          </button>
          <label class="btn btn-secondary" style="cursor:pointer;">
            ${Icons.get('upload', 15)} Importar Backup (.json)
            <input type="file" id="input-import-json" accept=".json,application/json" class="hidden" />
          </label>
        </div>
        <span style="font-size:11px; color:var(--text-muted);">Última gravação local: ${new Date(s.updatedAt).toLocaleString('pt-BR')}</span>
      </div>

      <div style="padding-top:14px; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div>
          <strong style="font-size:13px; color:var(--danger);">Restaurar padrões iniciais</strong>
          <p style="font-size:12px; color:var(--text-muted);">Apaga os registros locais atuais e recria o painel limpo.</p>
        </div>
        <button type="button" class="btn btn-danger btn-sm" id="btn-reset-data">Resetar</button>
      </div>
    `);
  }

  function handleFormSubmit(e) {
    const form = e.target;
    const s = Storage.getState();

    if (form.id === 'form-task') {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const payload = {
        title: fd.get('title').trim(),
        category: fd.get('category').trim() || 'Geral',
        priority: fd.get('priority'),
        dueDate: fd.get('dueDate')
      };

      if (id) {
        const idx = s.tasks.findIndex((t) => t.id === id);
        if (idx > -1) s.tasks[idx] = { ...s.tasks[idx], ...payload };
        showToast('Tarefa atualizada');
      } else {
        s.tasks.unshift({
          id: uid('tsk'),
          ...payload,
          completed: false,
          completedAt: null,
          createdAt: todayISO()
        });
        showToast('Tarefa adicionada');
      }
      Storage.save();
      closeModal();
      renderCurrentView();
    }

    if (form.id === 'form-course') {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      let progress = Math.min(100, Math.max(0, Number(fd.get('progress')) || 0));
      let status = fd.get('status');
      let endDate = fd.get('endDate');

      if (progress === 100 && status !== 'concluido') status = 'concluido';
      if (status === 'concluido' && progress < 100) progress = 100;
      if (status === 'concluido' && !endDate) endDate = todayISO();

      const payload = {
        name: fd.get('name').trim(),
        platform: fd.get('platform').trim(),
        category: fd.get('category').trim() || 'Tecnologia',
        progress,
        status,
        startDate: fd.get('startDate'),
        endDate,
        url: fd.get('url').trim(),
        notes: fd.get('notes').trim()
      };

      if (id) {
        const idx = s.courses.findIndex((c) => c.id === id);
        if (idx > -1) s.courses[idx] = { ...s.courses[idx], ...payload };
        showToast('Curso atualizado');
      } else {
        s.courses.unshift({ id: uid('crs'), ...payload });
        showToast('Curso cadastrado');
      }
      Storage.save();
      closeModal();
      renderCurrentView();
    }

    if (form.id === 'form-career') {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const status = fd.get('status');
      const payload = {
        company: fd.get('company').trim(),
        role: fd.get('role').trim(),
        location: fd.get('location').trim(),
        workModel: fd.get('workModel'),
        status,
        appliedDate: fd.get('appliedDate'),
        url: fd.get('url').trim(),
        notes: fd.get('notes').trim()
      };

      if (id) {
        const idx = s.career.findIndex((j) => j.id === id);
        if (idx > -1) {
          const prev = s.career[idx];
          const history = Array.isArray(prev.history) ? [...prev.history] : [];
          if (prev.status !== status) {
            history.push({ date: todayISO(), status, note: 'Atualização de etapa' });
          }
          s.career[idx] = { ...prev, ...payload, history };
        }
        showToast('Candidatura atualizada');
      } else {
        s.career.unshift({
          id: uid('job'),
          ...payload,
          history: [{ date: payload.appliedDate || todayISO(), status, note: 'Registro inicial' }]
        });
        showToast('Candidatura registrada');
      }
      Storage.save();
      closeModal();
      renderCurrentView();
    }

    if (form.id === 'form-project') {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const technologies = fd.get('technologies')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        name: fd.get('name').trim(),
        description: fd.get('description').trim(),
        technologies,
        status: fd.get('status'),
        progress: Math.min(100, Math.max(0, Number(fd.get('progress')) || 0)),
        githubUrl: fd.get('githubUrl').trim(),
        demoUrl: fd.get('demoUrl').trim(),
        createdDate: fd.get('createdDate'),
        notes: fd.get('notes').trim()
      };

      if (id) {
        const idx = s.projects.findIndex((p) => p.id === id);
        if (idx > -1) s.projects[idx] = { ...s.projects[idx], ...payload };
        showToast('Projeto atualizado');
      } else {
        s.projects.unshift({ id: uid('prj'), ...payload });
        showToast('Projeto criado');
      }
      Storage.save();
      closeModal();
      renderCurrentView();
    }

    if (form.id === 'form-goal') {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const payload = {
        title: fd.get('title').trim(),
        description: fd.get('description').trim(),
        category: fd.get('category').trim() || 'Geral',
        deadline: fd.get('deadline'),
        status: fd.get('status'),
        progress: Math.min(100, Math.max(0, Number(fd.get('progress')) || 0))
      };

      if (id) {
        const idx = s.goals.findIndex((g) => g.id === id);
        if (idx > -1) s.goals[idx] = { ...s.goals[idx], ...payload };
        showToast('Meta atualizada');
      } else {
        s.goals.unshift({ id: uid('gol'), ...payload, steps: [] });
        showToast('Meta criada');
      }
      Storage.save();
      closeModal();
      renderCurrentView();
    }

    if (form.id === 'form-note') {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const payload = {
        title: fd.get('title').trim(),
        category: fd.get('category').trim() || 'Geral',
        content: fd.get('content').trim(),
        pinned: fd.get('pinned') === 'on',
        updatedAt: new Date().toISOString()
      };

      if (id) {
        const idx = s.notes.findIndex((n) => n.id === id);
        if (idx > -1) s.notes[idx] = { ...s.notes[idx], ...payload };
        showToast('Nota atualizada');
      } else {
        s.notes.unshift({ id: uid('nte'), ...payload });
        showToast('Nota salva');
      }
      Storage.save();
      closeModal();
      renderCurrentView();
    }

    if (form.id === 'form-settings') {
      e.preventDefault();
      const fd = new FormData(form);
      const userName = fd.get('userName').trim();
      if (userName) {
        Storage.updateSettings({ userName });
        showToast('Nome atualizado');
        renderCurrentView();
      }
    }

    if (form.dataset.action === 'add-goal-step') {
      e.preventDefault();
      const goalId = form.dataset.goalId;
      const input = form.querySelector('input[name="stepText"]');
      const text = input.value.trim();
      if (!text) return;

      const goal = s.goals.find((g) => g.id === goalId);
      if (goal) {
        goal.steps = goal.steps || [];
        goal.steps.push({ id: uid('stp'), text, done: false });
        recalculateGoalProgress(goal);
        Storage.save();
        renderCurrentView();
      }
    }
  }

  function recalculateGoalProgress(goal) {
    if (!goal.steps || goal.steps.length === 0) return;
    const doneCount = goal.steps.filter((st) => st.done).length;
    goal.progress = Math.round((doneCount / goal.steps.length) * 100);
    if (goal.progress === 100) {
      goal.status = 'concluida';
    } else if (goal.progress > 0 && goal.status === 'nao_iniciada') {
      goal.status = 'em_andamento';
    }
  }

  function handleGlobalClick(e) {
    const routeBtn = e.target.closest('[data-route]');
    if (routeBtn) {
      navigate(routeBtn.dataset.route);
      return;
    }

    const taskTimeBtn = e.target.closest('[data-filter-task-time]');
    if (taskTimeBtn) {
      AppState.taskTimeFilter = taskTimeBtn.dataset.filterTaskTime;
      renderCurrentView();
      return;
    }

    const courseFilterBtn = e.target.closest('[data-filter-course]');
    if (courseFilterBtn) {
      AppState.courseStatusFilter = courseFilterBtn.dataset.filterCourse;
      renderCurrentView();
      return;
    }

    const careerFilterBtn = e.target.closest('[data-filter-career]');
    if (careerFilterBtn) {
      AppState.careerStatusFilter = careerFilterBtn.dataset.filterCareer;
      renderCurrentView();
      return;
    }

    const projectFilterBtn = e.target.closest('[data-filter-project]');
    if (projectFilterBtn) {
      AppState.projectStatusFilter = projectFilterBtn.dataset.filterProject;
      renderCurrentView();
      return;
    }

    if (e.target.id === 'btn-export-json') {
      Storage.exportJSON();
      showToast('Backup JSON exportado');
      return;
    }

    if (e.target.id === 'btn-reset-data') {
      if (confirm('Tem certeza que deseja apagar todos os registros locais e restaurar o estado inicial?')) {
        Storage.resetAll();
        closeModal();
        renderCurrentView();
        showToast('Dados restaurados para o padrão');
      }
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    const s = Storage.getState();

    switch (action) {
      case 'close-modal':
        closeModal();
        break;
      case 'open-settings':
        openSettingsModal();
        break;
      case 'modal-task':
        openTaskModal();
        break;
      case 'edit-task':
        openTaskModal(s.tasks.find((t) => t.id === id));
        break;
      case 'delete-task':
        s.tasks = s.tasks.filter((t) => t.id !== id);
        Storage.save();
        renderCurrentView();
        showToast('Tarefa excluída');
        break;
      case 'toggle-task': {
        const task = s.tasks.find((t) => t.id === id);
        if (task) {
          task.completed = !task.completed;
          task.completedAt = task.completed ? new Date().toISOString() : null;
          Storage.save();
          renderCurrentView();
        }
        break;
      }
      case 'modal-course':
        openCourseModal();
        break;
      case 'edit-course':
        openCourseModal(s.courses.find((c) => c.id === id));
        break;
      case 'delete-course':
        s.courses = s.courses.filter((c) => c.id !== id);
        Storage.save();
        renderCurrentView();
        showToast('Curso removido');
        break;
      case 'modal-career':
        openCareerModal();
        break;
      case 'edit-career':
        openCareerModal(s.career.find((j) => j.id === id));
        break;
      case 'delete-career':
        s.career = s.career.filter((j) => j.id !== id);
        Storage.save();
        renderCurrentView();
        showToast('Candidatura removida');
        break;
      case 'modal-project':
        openProjectModal();
        break;
      case 'edit-project':
        openProjectModal(s.projects.find((p) => p.id === id));
        break;
      case 'delete-project':
        s.projects = s.projects.filter((p) => p.id !== id);
        Storage.save();
        renderCurrentView();
        showToast('Projeto removido');
        break;
      case 'modal-goal':
        openGoalModal();
        break;
      case 'edit-goal':
        openGoalModal(s.goals.find((g) => g.id === id));
        break;
      case 'delete-goal':
        s.goals = s.goals.filter((g) => g.id !== id);
        Storage.save();
        renderCurrentView();
        showToast('Meta excluída');
        break;
      case 'toggle-goal-step': {
        const goal = s.goals.find((g) => g.id === actionEl.dataset.goalId);
        if (goal && goal.steps) {
          const step = goal.steps.find((st) => st.id === actionEl.dataset.stepId);
          if (step) {
            step.done = !step.done;
            recalculateGoalProgress(goal);
            Storage.save();
            renderCurrentView();
          }
        }
        break;
      }
      case 'delete-goal-step': {
        const goal = s.goals.find((g) => g.id === actionEl.dataset.goalId);
        if (goal && goal.steps) {
          goal.steps = goal.steps.filter((st) => st.id !== actionEl.dataset.stepId);
          recalculateGoalProgress(goal);
          Storage.save();
          renderCurrentView();
        }
        break;
      }
      case 'modal-note':
        openNoteModal();
        break;
      case 'edit-note':
        openNoteModal(s.notes.find((n) => n.id === id));
        break;
      case 'delete-note':
        s.notes = s.notes.filter((n) => n.id !== id);
        Storage.save();
        renderCurrentView();
        showToast('Nota excluída');
        break;
      case 'toggle-pin-note': {
        const note = s.notes.find((n) => n.id === id);
        if (note) {
          note.pinned = !note.pinned;
          Storage.save();
          renderCurrentView();
        }
        break;
      }
    }
  }

  function handleGlobalChange(e) {
    const target = e.target;
    const s = Storage.getState();

    if (target.id === 'filter-task-status') {
      AppState.taskStatusFilter = target.value;
      renderCurrentView();
    } else if (target.id === 'filter-task-priority') {
      AppState.taskPriorityFilter = target.value;
      renderCurrentView();
    } else if (target.id === 'note-category-select') {
      AppState.noteCategoryFilter = target.value;
      renderCurrentView();
    } else if (target.dataset.action === 'slide-course') {
      const course = s.courses.find((c) => c.id === target.dataset.id);
      if (course) {
        const val = Number(target.value);
        course.progress = val;
        if (val === 0) course.status = 'nao_iniciado';
        else if (val === 100) {
          course.status = 'concluido';
          if (!course.endDate) course.endDate = todayISO();
        } else {
          course.status = 'em_andamento';
        }
        Storage.save();
        renderCurrentView();
      }
    } else if (target.id === 'input-import-json' && target.files && target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          Storage.importJSON(ev.target.result);
          closeModal();
          renderCurrentView();
          showToast('Backup restaurado com sucesso');
        } catch (err) {
          alert(`Erro ao importar backup: ${err.message}`);
        }
      };
      reader.readAsText(target.files[0]);
    }
  }

  function handleGlobalInput(e) {
    if (e.target.id === 'note-search-input') {
      AppState.noteSearch = e.target.value;
      const caret = e.target.selectionStart;
      renderCurrentView();
      const newInput = document.getElementById('note-search-input');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(caret, caret);
      }
    }
  }

  function setupPWA() {
    const installButtons = [
      document.getElementById('btn-install-sidebar'),
      document.getElementById('btn-install-topbar')
    ].filter(Boolean);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      AppState.deferredInstallPrompt = e;
      installButtons.forEach((btn) => btn.classList.remove('hidden'));
    });

    installButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!AppState.deferredInstallPrompt) return;
        AppState.deferredInstallPrompt.prompt();
        const choice = await AppState.deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          showToast('Aplicativo instalado com sucesso');
        }
        AppState.deferredInstallPrompt = null;
        installButtons.forEach((b) => b.classList.add('hidden'));
      });
    });

    window.addEventListener('appinstalled', () => {
      installButtons.forEach((b) => b.classList.add('hidden'));
      AppState.deferredInstallPrompt = null;
    });

    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('./sw.js')
        .then((registration) => {
          if (registration.waiting) {
            AppState.waitingWorker = registration.waiting;
            document.getElementById('update-banner').classList.remove('hidden');
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                AppState.waitingWorker = newWorker;
                document.getElementById('update-banner').classList.remove('hidden');
              }
            });
          });
        })
        .catch((err) => console.warn('Registro do Service Worker ignorado:', err));

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      const updateBtn = document.getElementById('btn-sw-update');
      if (updateBtn) {
        updateBtn.addEventListener('click', () => {
          if (AppState.waitingWorker) {
            AppState.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    }
  }

  function init() {
    Icons.hydrateStaticIcons();
    updateClockAndDate();
    setInterval(updateClockAndDate, 1000);

    document.getElementById('btn-toggle-clock').addEventListener('click', () => {
      const current = Storage.getState().settings.showClock;
      Storage.updateSettings({ showClock: !current });
      updateClockAndDate();
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('submit', handleFormSubmit);
    document.addEventListener('change', handleGlobalChange);
    document.addEventListener('input', handleGlobalInput);

    setupPWA();
    renderCurrentView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

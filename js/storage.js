(function () {
  const STORAGE_KEY = 'axis_personal_workspace_v1';
  const SCHEMA_VERSION = 1;

  function todayISO() {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
  }

  function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
  }

  function createInitialState() {
    const today = todayISO();
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      settings: {
        userName: 'Tony',
        showClock: true
      },
      tasks: [
        {
          id: 'tsk-1',
          title: 'Revisar cronograma de estudos e metas da semana',
          category: 'Planejamento',
          priority: 'alta',
          dueDate: today,
          completed: false,
          completedAt: null,
          createdAt: today
        },
        {
          id: 'tsk-2',
          title: 'Organizar repositórios e documentação técnica no GitHub',
          category: 'Projetos',
          priority: 'media',
          dueDate: addDaysISO(2),
          completed: false,
          completedAt: null,
          createdAt: today
        }
      ],
      courses: [
        {
          id: 'crs-1',
          name: 'Python para Análise de Dados e Automação',
          platform: 'Documentação Oficial / Projetos Práticos',
          category: 'Programação',
          progress: 65,
          status: 'em_andamento',
          startDate: addDaysISO(-18),
          endDate: '',
          url: 'https://docs.python.org/pt-br/3/',
          notes: 'Foco em manipulação de dados com Pandas, automação de rotinas e scripts CLI.'
        }
      ],
      career: [
        {
          id: 'job-1',
          company: 'Empresa de Engenharia & Tecnologia',
          role: 'Estágio / Trainee em Engenharia e Desenvolvimento',
          location: 'Remoto / Híbrido',
          workModel: 'hibrido',
          url: '',
          appliedDate: today,
          status: 'interesse',
          notes: 'Acompanhar abertura do próximo ciclo seletivo e preparar portfólio técnico.',
          history: [
            { date: today, status: 'interesse', note: 'Vaga adicionada ao radar' }
          ]
        }
      ],
      projects: [
        {
          id: 'prj-1',
          name: 'Axis PWA — Painel Pessoal',
          description: 'Aplicativo web instalável (offline-first) para gestão integrada de tarefas, estudos, carreira e metas.',
          technologies: ['HTML5', 'CSS3', 'JavaScript', 'PWA', 'Service Worker'],
          status: 'em_desenvolvimento',
          progress: 90,
          githubUrl: 'https://github.com',
          demoUrl: '',
          createdDate: today,
          notes: 'Arquitetura modular preparada para sincronização futura via nuvem.'
        }
      ],
      goals: [
        {
          id: 'gol-1',
          title: 'Consolidar Portfólio Técnico e Projetos Aplicados',
          description: 'Publicar projetos documentados com código limpo, arquitetura clara e demonstrações funcionais.',
          category: 'Carreira',
          deadline: addDaysISO(60),
          progress: 50,
          status: 'em_andamento',
          steps: [
            { id: 'stp-1', text: 'Estruturar repositórios principais com README técnico', done: true },
            { id: 'stp-2', text: 'Publicar aplicação PWA funcional no GitHub Pages', done: false }
          ]
        }
      ],
      notes: [
        {
          id: 'nte-1',
          title: 'Checklist de Rotina & Backup',
          category: 'Sistema',
          content: '1. Revisar tarefas prioritárias toda manhã.\n2. Atualizar progresso dos cursos ao fim de cada módulo.\n3. Exportar backup JSON semanalmente em Backup & Ajustes.',
          pinned: true,
          updatedAt: new Date().toISOString()
        }
      ]
    };
  }

  class StorageManager {
    constructor() {
      this.state = this.load();
      this.listeners = [];
    }

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          const initial = createInitialState();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
          return initial;
        }
        const parsed = JSON.parse(raw);
        return this.normalize(parsed);
      } catch (err) {
        console.error('Falha ao ler armazenamento local:', err);
        return createInitialState();
      }
    }

    normalize(data) {
      const base = createInitialState();
      return {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: data.updatedAt || new Date().toISOString(),
        settings: {
          userName: (data.settings && data.settings.userName) || base.settings.userName,
          showClock: data.settings && typeof data.settings.showClock === 'boolean'
            ? data.settings.showClock
            : true
        },
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        courses: Array.isArray(data.courses) ? data.courses : [],
        career: Array.isArray(data.career) ? data.career : [],
        projects: Array.isArray(data.projects) ? data.projects : [],
        goals: Array.isArray(data.goals) ? data.goals : [],
        notes: Array.isArray(data.notes) ? data.notes : []
      };
    }

    save() {
      this.state.updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (err) {
        console.error('Erro ao salvar dados no LocalStorage:', err);
      }
      this.listeners.forEach((fn) => fn(this.state));
    }

    subscribe(fn) {
      this.listeners.push(fn);
    }

    getState() {
      return this.state;
    }

    updateSettings(partial) {
      this.state.settings = { ...this.state.settings, ...partial };
      this.save();
    }

    exportJSON() {
      const payload = JSON.stringify(this.state, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `axis-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    importJSON(rawText) {
      const parsed = JSON.parse(rawText);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Formato JSON inválido.');
      }
      const requiredCollections = ['tasks', 'courses', 'career', 'projects', 'goals', 'notes'];
      const hasValidStructure = requiredCollections.some((key) => Array.isArray(parsed[key]));
      if (!hasValidStructure) {
        throw new Error('O arquivo não corresponde à estrutura de backup do Axis.');
      }
      this.state = this.normalize(parsed);
      this.save();
      return this.state;
    }

    resetAll() {
      this.state = createInitialState();
      this.save();
      return this.state;
    }

    getSyncSnapshot() {
      return {
        schemaVersion: this.state.schemaVersion,
        updatedAt: this.state.updatedAt,
        data: this.state
      };
    }
  }

  window.AxisStorage = new StorageManager();
  window.AxisDateUtils = { todayISO, addDaysISO };
})();

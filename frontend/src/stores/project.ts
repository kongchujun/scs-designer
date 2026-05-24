import { defineStore } from 'pinia'
import { ref } from 'vue'
import { designsApi, projectsApi, type Design, type Project } from '@/api/client'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const designs = ref<Design[]>([])
  const currentProjectId = ref<number | null>(null)
  const currentDesignId = ref<number | null>(null)

  async function loadProjects() {
    projects.value = await projectsApi.list()
  }

  async function createProject(name: string) {
    const p = await projectsApi.create({ name, description: '预处理箱设计项目' })
    projects.value.unshift(p)
    currentProjectId.value = p.id
    return p
  }

  async function loadDesigns(projectId: number) {
    designs.value = await designsApi.list(projectId)
    currentProjectId.value = projectId
  }

  async function createDesign(projectId: number, name: string) {
    const d = await designsApi.create({ project_id: projectId, name })
    designs.value.unshift(d)
    currentDesignId.value = d.id
    return d
  }

  return {
    projects,
    designs,
    currentProjectId,
    currentDesignId,
    loadProjects,
    createProject,
    loadDesigns,
    createDesign,
  }
})

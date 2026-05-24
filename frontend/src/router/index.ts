import { createRouter, createWebHistory } from 'vue-router'
import ProjectsView from '@/views/ProjectsView.vue'
import DesignerView from '@/views/DesignerView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'projects', component: ProjectsView },
    { path: '/designer/:designId', name: 'designer', component: DesignerView },
  ],
})

export default router

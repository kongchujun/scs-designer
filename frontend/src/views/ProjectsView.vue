<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { designsApi, projectsApi } from '@/api/client'
import { useDesignStore } from '@/stores/design'
import { useLocaleStore } from '@/stores/locale'
import { useProjectStore } from '@/stores/project'
import LanguageSelect from '@/components/common/LanguageSelect.vue'

const router = useRouter()
const projectStore = useProjectStore()
const designStore = useDesignStore()
const locale = useLocaleStore()
const newProjectName = ref('')

onMounted(() => {
  newProjectName.value = locale.t('projects.newName')
  projectStore.loadProjects()
})

async function createProject() {
  const p = await projectStore.createProject(newProjectName.value)
  const d = await projectStore.createDesign(p.id, locale.t('projects.defaultDesign'))
  designStore.loadDocument(d.config_json, d.id, d.name)
  router.push(`/designer/${d.id}`)
}

async function openDesign(designId: number) {
  const d = await designsApi.get(designId)
  designStore.loadDocument(d.config_json, d.id, d.name)
  router.push(`/designer/${d.id}`)
}

async function deleteProject(id: number) {
  await ElMessageBox.confirm(locale.t('projects.deleteConfirm'), locale.t('projects.confirmTitle'))
  await projectsApi.remove(id)
  await projectStore.loadProjects()
  ElMessage.success(locale.t('projects.deleted'))
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ locale.t('projects.title') }}</h1>
      <LanguageSelect />
    </div>
    <div class="toolbar">
      <el-input v-model="newProjectName" style="width: 280px" :placeholder="locale.t('projects.namePlaceholder')" />
      <el-button type="primary" @click="createProject">{{ locale.t('projects.create') }}</el-button>
    </div>
    <el-table :data="projectStore.projects" stripe>
      <el-table-column prop="id" :label="locale.t('projects.colId')" width="70" />
      <el-table-column prop="name" :label="locale.t('projects.colName')" />
      <el-table-column prop="description" :label="locale.t('projects.colDesc')" />
      <el-table-column :label="locale.t('projects.colActions')" width="280">
        <template #default="{ row }">
          <el-button size="small" @click="projectStore.loadDesigns(row.id)">
            {{ locale.t('projects.loadDesigns') }}
          </el-button>
          <el-button size="small" type="danger" @click="deleteProject(row.id)">
            {{ locale.t('projects.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="projectStore.designs.length" class="designs">
      <h3>{{ locale.t('projects.designList', { id: projectStore.currentProjectId ?? '' }) }}</h3>
      <el-table :data="projectStore.designs">
        <el-table-column prop="name" :label="locale.t('projects.colDesignName')" />
        <el-table-column prop="updated_at" :label="locale.t('projects.colUpdated')" />
        <el-table-column :label="locale.t('projects.colActions')" width="140">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openDesign(row.id)">
              {{ locale.t('projects.openDesigner') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.page-head h1 {
  margin: 0;
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.designs {
  margin-top: 32px;
}
</style>

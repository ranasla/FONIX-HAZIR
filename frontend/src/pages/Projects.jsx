import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { projectsAPI } from '../services/api'
import './Projects.css'

const Projects = () => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await projectsAPI.getAll()
      setProjects(response.data.projects)
    } catch (error) {
      console.error('Projeler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (projectId) => {
    if (!window.confirm('Bu projeyi silmek istediğinize emin misiniz?')) return
    
    try {
      await projectsAPI.delete(projectId)
      setProjects(projects.filter(p => p.id !== projectId))
    } catch (error) {
      console.error('Proje silinirken hata:', error)
    }
  }

  return (
    <Layout title="Projelerim">
      <div className="hero">
        <h1>📁 Projelerim</h1>
        <p>Şarkı yazım projelerini buradan yönet!</p>
      </div>

      <div className="projects-header">
        <span className="project-count">{projects.length} proje</span>
        <Link to="/lyrics" className="btn btn-primary">
          ➕ Yeni Proje
        </Link>
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <span>📁</span>
          <p>Henüz proje oluşturmadınız</p>
          <Link to="/lyrics" className="btn btn-primary">İlk Projeyi Oluştur</Link>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div key={project.id} className="project-card">
              <div className="project-header">
                <div className="project-icon" style={{ background: `linear-gradient(135deg, #ff146a, #9b59b6)` }}>
                  📝
                </div>
                <div>
                  <h4 className="project-title">{project.title}</h4>
                  <p className="project-date">
                    {new Date(project.updated_at).toLocaleDateString('tr', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="project-preview">
                {project.lyrics?.slice(0, 120) || 'Boş proje...'}
                {project.lyrics?.length > 120 && '...'}
              </div>
              
              <div className="project-tags">
                <span className="tag">{project.mood}</span>
                <span className="tag">{project.energy_level}</span>
                {project.beat && <span className="tag">🎵 {project.beat.name}</span>}
              </div>
              
              <div className="project-actions">
                <Link to={`/lyrics?project_id=${project.id}`} className="btn btn-secondary">
                  ✏️ Düzenle
                </Link>
                <button className="btn btn-danger" onClick={() => handleDelete(project.id)}>
                  🗑️ Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

export default Projects

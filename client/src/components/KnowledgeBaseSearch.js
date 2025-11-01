import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './KnowledgeBaseSearch.css';

function KnowledgeBaseSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [kbStats, setKbStats] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // search, browse, stats
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});

  // Fetch KB stats on mount
  useEffect(() => {
    fetchKBStats();
  }, []);

  const fetchKBStats = async () => {
    try {
      const response = await axios.get('/api/kb/stats');
      if (response.data.success) {
        setKbStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching KB stats:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get('/api/kb/search', {
        params: { q: searchQuery }
      });
      if (response.data.success) {
        setSearchResults(response.data.results);
      }
    } catch (error) {
      console.error('Error searching KB:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticles = async (category = null, page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (category) {
        params.category = category;
      }
      const response = await axios.get('/api/kb/articles', { params });
      if (response.data.success) {
        setArticles(response.data.articles);
        setPagination({
          page: response.data.page,
          total_pages: response.data.total_pages,
          total: response.data.total
        });
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    fetchArticles(category, 1);
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) {
      return (
        <div className="empty-state">
          {searchQuery ? '没有找到匹配的模式' : '输入搜索词开始查询'}
        </div>
      );
    }

    return (
      <div className="search-results">
        <h3>找到 {searchResults.length} 个相关模式</h3>
        {searchResults.map((result) => (
          <div key={result.pattern.id} className="pattern-card">
            <div className="pattern-header">
              <h4>{result.pattern.name}</h4>
              <span className={`severity ${result.pattern.severity.toLowerCase()}`}>
                {result.pattern.severity}
              </span>
            </div>
            <p className="pattern-desc">{result.pattern.description}</p>
            <div className="pattern-meta">
              <span className="category">{result.pattern.category}</span>
              <span className="solutions-count">
                {result.solution_count} 个解决方案
              </span>
            </div>
            {result.solutions.length > 0 && (
              <div className="solutions-preview">
                <h5>推荐解决方案：</h5>
                {result.solutions.map((sol) => (
                  <div key={sol.id} className="solution-item">
                    <strong>{sol.title}</strong>
                    <p>{sol.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderArticles = () => {
    if (articles.length === 0) {
      return <div className="empty-state">没有文章</div>;
    }

    return (
      <div className="articles-list">
        {articles.map((article) => (
          <div key={article.id} className="article-card">
            <div className="article-header">
              <h4>{article.name}</h4>
              <span className={`severity ${article.severity.toLowerCase()}`}>
                {article.severity}
              </span>
            </div>
            <p>{article.description}</p>
            <div className="article-meta">
              <span className="category">{article.category}</span>
              <span className="solutions">
                {article.solutions.length} 个解决方案
              </span>
            </div>
            {article.solutions.length > 0 && (
              <div className="solutions-expanded">
                {article.solutions.map((sol) => (
                  <div key={sol.id} className="solution-full">
                    <h5>{sol.title}</h5>
                    {sol.root_cause && (
                      <div>
                        <strong>根本原因：</strong>
                        <p>{sol.root_cause}</p>
                      </div>
                    )}
                    {sol.solution_steps && (
                      <div>
                        <strong>解决步骤：</strong>
                        <ol>
                          {JSON.parse(sol.solution_steps).map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {pagination.total_pages > 1 && (
          <div className="pagination">
            <button
              onClick={() => fetchArticles(selectedCategory, currentPage - 1)}
              disabled={currentPage === 1}
            >
              上一页
            </button>
            <span>
              第 {currentPage} / {pagination.total_pages} 页 (共 {pagination.total} 个)
            </span>
            <button
              onClick={() => fetchArticles(selectedCategory, currentPage + 1)}
              disabled={currentPage === pagination.total_pages}
            >
              下一页
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStats = () => {
    if (!kbStats) {
      return <div className="empty-state">加载中...</div>;
    }

    return (
      <div className="kb-stats">
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-value">{kbStats.total_patterns}</div>
            <div className="stat-label">错误模式</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{kbStats.total_solutions}</div>
            <div className="stat-label">解决方案</div>
          </div>
        </div>

        <div className="stats-details">
          <div className="stats-column">
            <h4>按类别分布</h4>
            <div className="category-list">
              {Object.entries(kbStats.by_category || {}).map(([cat, count]) => (
                <div
                  key={cat}
                  className="category-item"
                  onClick={() => handleCategoryFilter(cat)}
                >
                  <span>{cat}</span>
                  <span className="count">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-column">
            <h4>按严重级别分布</h4>
            <div className="severity-list">
              {Object.entries(kbStats.by_severity || {}).map(([sev, count]) => (
                <div key={sev} className={`severity-item ${sev.toLowerCase()}`}>
                  <span>{sev}</span>
                  <span className="count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="kb-search-container">
      <div className="kb-header">
        <h1>📚 知识库</h1>
        <p>搜索错误模式、浏览解决方案、学习最佳实践</p>
      </div>

      <div className="kb-tabs">
        <button
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 搜索
        </button>
        <button
          className={`tab-button ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('browse');
            if (articles.length === 0) {
              fetchArticles();
            }
          }}
        >
          📖 浏览
        </button>
        <button
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 统计
        </button>
      </div>

      <div className="kb-content">
        {activeTab === 'search' && (
          <div className="search-section">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="搜索错误模式、类别、关键词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-button">
                搜索
              </button>
            </form>
            {loading ? <div className="loading">搜索中...</div> : renderSearchResults()}
          </div>
        )}

        {activeTab === 'browse' && (
          <div className="browse-section">
            <div className="browse-header">
              {kbStats && (
                <div className="filter-chips">
                  <button
                    className={`filter-chip ${!selectedCategory ? 'active' : ''}`}
                    onClick={() => handleCategoryFilter(null)}
                  >
                    全部 ({kbStats.total_patterns})
                  </button>
                  {Object.entries(kbStats.by_category || {}).map(([cat, count]) => (
                    <button
                      key={cat}
                      className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => handleCategoryFilter(cat)}
                    >
                      {cat} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>
            {loading ? <div className="loading">加载中...</div> : renderArticles()}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-section">
            {loading ? <div className="loading">加载中...</div> : renderStats()}
          </div>
        )}
      </div>
    </div>
  );
}

export default KnowledgeBaseSearch;

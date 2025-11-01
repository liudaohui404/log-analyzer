import React from 'react';
import AnalysisResults from './AnalysisResults';

function FileViewer({ data }) {
  return (
    <div className="space-y-6">
      {/* Analysis Results */}
      <AnalysisResults analysis={data.analysis} analysisId={data.analysisId} />
    </div>
  );
}

export default FileViewer;

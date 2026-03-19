import React from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { usePos } from '../context/PosContext';
import { exportPosDataToExcel } from '../utils/exportToExcel';

export const ExportButton: React.FC = () => {
  const { products, sales, financeMovements, clients, credits, fridgeLoans, rawMaterials } = usePos();

  const handleExport = () => {
    exportPosDataToExcel({
      products,
      sales,
      financeMovements,
      clients,
      credits,
      fridgeLoans,
      rawMaterials,
    });
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="btn-secondary gap-2 px-3"
    >
      <ArrowDownTrayIcon className="h-5 w-5" />
      <span>Exportar a Excel</span>
    </button>
  );
};

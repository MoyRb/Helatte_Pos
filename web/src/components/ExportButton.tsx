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
      className="inline-flex items-center gap-2 rounded-xl border border-borderSoft bg-surface px-3 py-2 text-sm font-semibold text-coffee shadow-card hover:border-primary/30 hover:bg-secondarySoft"
    >
      <ArrowDownTrayIcon className="h-5 w-5" />
      <span>Exportar a Excel</span>
    </button>
  );
};

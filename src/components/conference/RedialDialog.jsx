// src/components/conference/RedialDialog.jsx
import React from 'react';

const RedialDialog = ({ participant, onConfirm, onCancel }) => {
  if (!participant) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998]">
      <div className="bg-white dark:bg-boxdark rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
          Confirm Redial
        </h3>
        
        <div className="mb-6">
          <p className="text-bodydark2 mb-2">
            Are you sure you want to redial:
          </p>
          <div className="bg-gray-2 dark:bg-form-strokedark rounded p-3">
            <p className="font-medium text-black dark:text-white">
              {participant.display_name}
            </p>
            <p className="text-sm text-bodydark2">
              {participant.uri}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded border border-stroke px-4 py-2 text-sm font-medium hover:bg-gray-2"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(participant)}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-gray hover:bg-opacity-90"
          >
            Redial Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default RedialDialog;
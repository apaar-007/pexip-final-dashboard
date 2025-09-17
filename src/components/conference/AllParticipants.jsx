// src/components/conference/AllParticipants.jsx
import React, { useState } from 'react';

const AllParticipants = ({ allTimeParticipants, onRedial, userRole }) => {
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  const calculateDuration = (joinTime, disconnectTime) => {
    const start = new Date(joinTime);
    const end = disconnectTime ? new Date(disconnectTime) : new Date();
    const duration = Math.floor((end - start) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  };
  
  const participantsList = Object.values(allTimeParticipants);
  const filteredList = showActiveOnly 
    ? participantsList.filter(p => p.isActive)
    : participantsList;
  
  const activeCount = participantsList.filter(p => p.isActive).length;
  const totalCount = participantsList.length;
  
  return (
    <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-black dark:text-white">
            All Participants ({activeCount}/{totalCount})
          </h3>
          <p className="text-sm text-bodydark2 mt-1">
            Active: {activeCount} | Disconnected: {totalCount - activeCount}
          </p>
        </div>
        <button
          onClick={() => setShowActiveOnly(!showActiveOnly)}
          className="rounded-md bg-gray-3 dark:bg-form-input px-3 py-1.5 text-sm hover:bg-opacity-90"
        >
          {showActiveOnly ? 'Show All' : 'Active Only'}
        </button>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredList.length === 0 ? (
          <p className="text-bodydark2">No participants to display</p>
        ) : (
          filteredList.map((participant, index) => (
            <div 
              key={`${participant.display_name}-${index}`}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-2 dark:bg-form-strokedark"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    participant.isActive ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                  <p className="font-medium text-black dark:text-white">
                    {participant.display_name}
                  </p>
                  {participant.role === 'chair' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-primary text-white">
                      Host
                    </span>
                  )}
                </div>
                
                <div className="mt-1 text-xs text-bodydark2 space-y-0.5">
                  <p>Joined: {formatTime(participant.joinTime)}</p>
                  {participant.disconnectTime && (
                    <p>Left: {formatTime(participant.disconnectTime)}</p>
                  )}
                  <p>Duration: {calculateDuration(participant.joinTime, participant.disconnectTime)}</p>
                  {participant.disconnectReason && !participant.isActive && (
                    <p>Reason: {participant.disconnectReason}</p>
                  )}
                </div>
              </div>
              
              {!participant.isActive && userRole === 'chair' && participant.uri && (
                <button
                  onClick={() => onRedial(participant)}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-gray hover:bg-opacity-90"
                >
                  Redial
                </button>
              )}
              
              {!participant.isActive && !participant.uri && (
                <span className="text-xs text-bodydark2 italic">
                  Cannot redial
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AllParticipants;
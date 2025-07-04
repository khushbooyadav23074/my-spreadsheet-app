import React, { useState } from 'react';
import statsImage from '../assets/stats.svg'; // User avatar image
import logoImage from '../assets/logo.svg'; // Import the new logo image

interface HeaderProps {
  onSearch: (query: string) => void;
  onButtonClick: (action: string) => void;
  userId: string | null;
}

const Header: React.FC<HeaderProps> = ({ onSearch, onButtonClick, userId }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <header className="flex items-center justify-between p-4 bg-white shadow-md rounded-b-lg">
      {/* Logo */}
      <div className="flex items-center space-x-2">
        {/* Replaced SVG logo with img tag using the imported logo.svg */}
        <img
          src={logoImage}
          alt="Company Logo"
          className="w-8 h-8 text-blue-600" // You might need to adjust styling for your SVG
        />
        <span className="text-xl font-bold text-gray-800">Gob</span>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex-grow mx-8 max-w-md">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out"
            value={searchQuery}
            onChange={handleSearchChange}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>
        </div>
      </form>

      {/* User and Action Buttons */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => onButtonClick('New Project')}
          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
        >
          New Project
        </button>
        <button
          onClick={() => onButtonClick('Notifications')}
          className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition duration-150 ease-in-out"
        >
          <svg
            className="h-6 w-6 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            ></path>
          </svg>
        </button>
        <div className="relative">
          <img
            src={statsImage} // Now using the imported stats.svg
            alt="User Avatar"
            className="w-10 h-10 rounded-full border-2 border-blue-500 cursor-pointer"
            onClick={() => onButtonClick('User Profile')}
          />
          <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-green-400"></span>
        </div>
        {userId && (
          <div className="text-sm text-gray-600">
            User ID: <span className="font-mono text-xs">{userId}</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;



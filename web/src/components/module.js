import React, { useState } from 'react';

const Modules = ({ modules, setModules, isTeacher }) => {
    const [expandedModule, setExpandedModule] = useState(null);

    const handleDeleteModule = (moduleId) => {
        setModules(modules.filter(module => module.id !== moduleId));
    };

    const handleEditModule = (moduleId, newName) => {
        setModules(modules.map(module =>
            module.id === moduleId ? { ...module, name: newName } : module
        ));
    };

    const toggleModuleExpand = (moduleId) => {
        setExpandedModule(expandedModule === moduleId ? null : moduleId);
    };

    const handleFileUpload = (moduleId, event) => {
        const file = event.target.files[0];
        if (file) {
            setModules(modules.map(module =>
                module.id === moduleId
                    ? { ...module, content: [...module.content, { type: 'file', data: file.name }] }
                    : module
            ));
        }
    };

    return (
        <div>
            {modules.length === 0 ? (
                <p>No modules created yet.</p>
            ) : (
                modules.map(module => (
                    <div key={module.id} className="card mb-3">
                        <div className="card-header d-flex justify-content-between align-items-center">
                            <h5 className="mb-0" onClick={() => toggleModuleExpand(module.id)} style={{ cursor: 'pointer' }}>
                                {module.name}
                            </h5>
                            {isTeacher && (
                                <div>
                                    <button
                                        className="btn btn-sm btn-outline-primary me-2"
                                        onClick={() => handleEditModule(module.id, prompt('New module name:', module.name))}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => handleDeleteModule(module.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                        {expandedModule === module.id && (
                            <div className="card-body">
                                {isTeacher && (
                                    <div className="mb-3">
                                        <input
                                            type="file"
                                            className="form-control mb-2"
                                            onChange={(e) => handleFileUpload(module.id, e)}
                                        />
                                        <textarea
                                            className="form-control"
                                            placeholder="Add text content"
                                        />
                                        <button className="btn btn-secondary mt-2">Save Content</button>
                                    </div>
                                )}
                                {module.content.map((item, index) => (
                                    <p key={index}>{item.type === 'file' ? `File: ${item.data}` : item.data}</p>
                                ))}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

export default Modules;
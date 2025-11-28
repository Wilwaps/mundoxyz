import React, { useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const HTMLEditor = ({ value, onChange, placeholder = "Escribe el contenido aquí...", height = '300px' }) => {
  const quillRef = useRef(null);

  // Configuración de la barra de herramientas personalizada
  const modules = {
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean'],
        ['code-block'],
        [{ 'direction': 'rtl' }]
      ],
      handlers: {
        // Handler personalizado para imágenes (puedes agregar upload de imágenes aquí)
        image: function() {
          const range = this.quill.getSelection();
          const url = prompt('Enter the image URL:');
          if (url) {
            this.quill.insertEmbed(range.index, 'image', url);
          }
        }
      }
    },
    clipboard: {
      // match visual styles between Quill and your existing content
      matchVisual: false,
    }
  };

  // Formatos permitidos
  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'video',
    'color', 'background',
    'align', 'direction', 'code-block'
  ];

  // Estilos personalizados para el editor
  useEffect(() => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      
      // Personalizar estilos del editor
      const editorContainer = quill.container;
      const toolbar = quill.getModule('toolbar').container;
      
      // Aplicar estilos que coincidan con el tema de MUNDOXYZ
      editorContainer.style.backgroundColor = 'transparent';
      editorContainer.style.color = '#e5e7eb';
      editorContainer.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      editorContainer.style.borderRadius = '0.5rem';
      
      toolbar.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      toolbar.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      toolbar.style.borderRadius = '0.5rem 0.5rem 0 0';
      toolbar.style.borderBottom = 'none';
      
      // Personalizar botones de la toolbar
      const buttons = toolbar.querySelectorAll('button');
      buttons.forEach(button => {
        button.style.color = '#9ca3af';
        button.style.border = 'none';
        button.style.borderRadius = '0.25rem';
        button.style.padding = '0.25rem 0.5rem';
        button.style.margin = '0.125rem';
        button.style.backgroundColor = 'transparent';
        button.style.cursor = 'pointer';
        
        button.addEventListener('mouseenter', () => {
          button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          button.style.color = '#e5e7eb';
        });
        
        button.addEventListener('mouseleave', () => {
          if (!button.classList.contains('ql-active')) {
            button.style.backgroundColor = 'transparent';
            button.style.color = '#9ca3af';
          }
        });
      });
      
      // Personalizar botones activos
      const activeButtons = toolbar.querySelectorAll('.ql-active');
      activeButtons.forEach(button => {
        button.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
        button.style.color = '#38bdf8';
      });
      
      // Personalizar selects y dropdowns
      const selects = toolbar.querySelectorAll('select');
      selects.forEach(select => {
        select.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        select.style.color = '#e5e7eb';
        select.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        select.style.borderRadius = '0.25rem';
        select.style.padding = '0.25rem';
      });
      
      // Personalizar el contenido del editor
      const editor = editorContainer.querySelector('.ql-editor');
      if (editor) {
        editor.style.color = '#e5e7eb';
        editor.style.fontSize = '14px';
        editor.style.lineHeight = '1.6';
        
        // Estilos para elementos dentro del editor
        const style = document.createElement('style');
        style.textContent = `
          .ql-editor h1 { color: #f3f4f6; font-size: 2em; font-weight: bold; margin: 0.5em 0; }
          .ql-editor h2 { color: #f3f4f6; font-size: 1.5em; font-weight: bold; margin: 0.5em 0; }
          .ql-editor h3 { color: #f3f4f6; font-size: 1.25em; font-weight: bold; margin: 0.5em 0; }
          .ql-editor p { margin: 0.5em 0; }
          .ql-editor ul, .ql-editor ol { margin: 0.5em 0; padding-left: 2em; }
          .ql-editor li { margin: 0.25em 0; }
          .ql-editor blockquote { 
            border-left: 4px solid #38bdf8; 
            padding-left: 1em; 
            margin: 1em 0; 
            color: #9ca3af; 
            font-style: italic;
          }
          .ql-editor a { color: #38bdf8; text-decoration: underline; }
          .ql-editor strong { color: #f3f4f6; font-weight: bold; }
          .ql-editor em { color: #d1d5db; font-style: italic; }
          .ql-editor code { 
            background: rgba(255, 255, 255, 0.1); 
            padding: 0.125rem 0.25rem; 
            border-radius: 0.25rem; 
            font-family: monospace;
            color: #38bdf8;
          }
          .ql-editor pre { 
            background: rgba(0, 0, 0, 0.3); 
            padding: 1em; 
            border-radius: 0.5rem; 
            margin: 1em 0;
            overflow-x: auto;
          }
          .ql-editor img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.5em 0; }
          .ql-editor.ql-blank::before { color: #6b7280; }
        `;
        editor.appendChild(style);
      }
    }
  }, []);

  return (
    <div className="html-editor-container">
      <style jsx>{`
        .html-editor-container {
          position: relative;
        }
        
        .html-editor-container .ql-toolbar {
          border-radius: 0.5rem 0.5rem 0 0 !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-bottom: none !important;
          background: rgba(255, 255, 255, 0.05) !important;
        }
        
        .html-editor-container .ql-container {
          border-radius: 0 0 0.5rem 0.5rem !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-top: none !important;
          background: transparent !important;
        }
        
        .html-editor-container .ql-editor {
          min-height: ${height} !important;
          color: #e5e7eb !important;
          font-size: 14px !important;
          line-height: 1.6 !important;
        }
        
        .html-editor-container .ql-editor.ql-blank::before {
          color: #6b7280 !important;
          font-style: normal !important;
        }
        
        /* Personalizar tooltips */
        .html-editor-container .ql-tooltip {
          background: #1f2937 !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 0.5rem !important;
          color: #e5e7eb !important;
        }
        
        .html-editor-container .ql-tooltip input {
          background: rgba(255, 255, 255, 0.1) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          color: #e5e7eb !important;
          border-radius: 0.25rem !important;
          padding: 0.5rem !important;
        }
        
        .html-editor-container .ql-action {
          background: #38bdf8 !important;
          color: #111827 !important;
          border-radius: 0.25rem !important;
        }
        
        .html-editor-container .ql-tooltip .ql-remove {
          background: #ef4444 !important;
          color: white !important;
          border-radius: 0.25rem !important;
        }
        
        /* Estilos para el preview */
        .html-preview {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          padding: 1rem;
          color: #e5e7eb;
          min-height: ${height};
          max-height: ${height};
          overflow-y: auto;
        }
        
        .html-preview h1,
        .html-preview h2,
        .html-preview h3,
        .html-preview h4,
        .html-preview h5,
        .html-preview h6 {
          color: #f3f4f6;
          font-weight: bold;
          margin: 0.5em 0;
        }
        
        .html-preview h1 { font-size: 2em; }
        .html-preview h2 { font-size: 1.5em; }
        .html-preview h3 { font-size: 1.25em; }
        
        .html-preview p {
          margin: 0.5em 0;
          line-height: 1.6;
        }
        
        .html-preview ul,
        .html-preview ol {
          margin: 0.5em 0;
          padding-left: 2em;
        }
        
        .html-preview li {
          margin: 0.25em 0;
        }
        
        .html-preview blockquote {
          border-left: 4px solid #38bdf8;
          padding-left: 1em;
          margin: 1em 0;
          color: #9ca3af;
          font-style: italic;
        }
        
        .html-preview a {
          color: #38bdf8;
          text-decoration: underline;
        }
        
        .html-preview strong {
          color: #f3f4f6;
          font-weight: bold;
        }
        
        .html-preview em {
          color: #d1d5db;
          font-style: italic;
        }
        
        .html-preview code {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: monospace;
          color: #38bdf8;
        }
        
        .html-preview pre {
          background: rgba(0, 0, 0, 0.3);
          padding: 1em;
          border-radius: 0.5rem;
          margin: 1em 0;
          overflow-x: auto;
        }
        
        .html-preview pre code {
          background: none;
          padding: 0;
        }
        
        .html-preview img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.5em 0;
        }
      `}</style>
      
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        style={{ height }}
      />
    </div>
  );
};

export default HTMLEditor;
